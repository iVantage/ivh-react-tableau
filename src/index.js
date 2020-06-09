import React, { Component } from 'react'
import PropTypes from 'prop-types'

import {
  ERROR_NONE,
  ERROR_GENERIC,
  ERROR_PERMISSIONS,
  ERROR_MESSAGES
} from './constants/errors'

const DEFAULT_TABLEAU_TRUSTED_URI = '/api/tableau/trustedurl'

const fetchOpts = {
  credentials: 'same-origin',
  headers: {
    'Content-Type': 'application/json'
  }
}

const propTypes = {
  url: PropTypes.string.isRequired,
  user: PropTypes.string,
  tableauTrustedUrl: PropTypes.string,
  filters: PropTypes.object,
  parameters: PropTypes.object,
  onDashboardLoad: PropTypes.func,
  checkDashboardDimensions: PropTypes.bool,
  hideToolbar: PropTypes.bool
}

const defaultProps = {
  tableauTrustedUrl: DEFAULT_TABLEAU_TRUSTED_URI,
  filters: {},
  onDashboardLoad: () => {},
  checkDashboardDimensions: false
}

const STANDARD_MIN_WIDTH = 880
const STANDARD_MAX_WIDTH = 1280

const DEBUG = window.location.search.indexOf('debug') > -1

/**
 * Promises returned from Tableau's async functions are not *true*
 * JS Promises, they merely return an object with a `then` method
 * that makes them look like a Promise. This creates problems if you
 * want to do things like Promise.all(...) on a bunch of Tableau
 * promises.
 *
 * To get around this, we can wrap Tableau "promise" objects in
 * an actual promise so we can work with them as we normally would.
 */
const getPromiseFromTableauPromise = (tableauPromise) => {
  return new Promise((resolve, reject) => {
    tableauPromise.then((result) => {
      resolve(result)
    }, (err) => {
      reject(err)
    })
  })
}

class IvhTableauDashboard extends Component {
  constructor (props) {
    super(props)
    this.state = {
      maxSize: {},
      minSize: {},
      preLoadParams: {},
      preLoadFilters: {},
      error: ERROR_NONE,
      filters: props.filters,
      parameters: props.parameters,
      thirdPartyCookiesEnabled: true
    }
    this.resizeListening = false
    this.resizeEventListener = this.resizeViz.bind(this)
    this.messageEventListener = this.checkThirdPartyCookies.bind(this)
  }

  resizeViz () {
    if (!this.viz) {
      // It's possible for us to have a viz, then lose it without unmounting.
      // This can happen when after we init a new trusted view (e.g. after
      // `componentDidUpdate`) but there's an error building the viz.
      return
    }
    let width = this.container.clientWidth
    // Allow the tableau embed to maintain its full height. If
    // necessary, height can be applied to the containing element
    let height = this.state.maxSize.hasOwnProperty('height')
      ? this.state.maxSize.height
      : '500px'
    this.viz.setFrameSize(width, height)
  }

  checkThirdPartyCookies (event) {
    // Because there ain't no party like a third party
    if (event.data === 'ivantage:3PCunsupported') {
      this.setState({ thirdPartyCookiesEnabled: false })
      window.removeEventListener('message', this.messageEventListener)
    } else if (event.data === 'ivantage:3PCsupported') {
      this.setState({ thirdPartyCookiesEnabled: true })
      window.removeEventListener('message', this.messageEventListener)
    }
  }

  /**
   * Get a promise for window.tableau
   */
  getTableau () {
    if (window.tableau) {
      return Promise.resolve(window.tableau)
    }

    // We'll give it one minute? That's crazy long.
    let startTime = Date.now()
    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        if (window.tableau) {
          clearInterval(interval)
          return resolve(window.tableau)
        }

        if (Date.now() - startTime > 60 * 1000) {
          clearInterval(interval)
          return reject(new Error('Timed out waiting for Tableau to become available.'))
        }
      }, 100)
    })
  }

  /**
   * Just get window.tableau
   *
   * It's not guaranteed to be there... I hope you know what you're doing...
   */
  getTableauSyncUnsafe () {
    if (!window.tableau) {
      throw new Error('Accessing window.tableau before it is available')
    }
    return window.tableau
  }

  /**
   * Initializes a Tableau viz for the trusted URL currently in the state
   */
  initTableau (trustedUrl) {
    // Clear any previously determined dashboard dimensions
    this.setState({
      maxSize: {},
      minSize: {}
    })

    const options = {
      ...this.props,
      ...this.state.preLoadParams,
      ...this.props.parameters,
      ...this.state.preLoadFilters,
      ...this.props.filters,
      hideToolbar: !DEBUG, // Show the toolbar in debug mode
      onFirstInteractive: ((parameters, filters) => {
        return () => {
          this.workbook = this.viz.getWorkbook()
          this.activeSheet = this.workbook.getActiveSheet()
          const size = this.activeSheet.getSize()
          this.setState({
            maxSize: size.maxSize,
            minSize: size.minSize
          })

          if (!this.resizeListening) {
            window.addEventListener('resize', this.resizeEventListener)
            this.resizeListening = true
          }

          this.props.onDashboardLoad(this.workbook)

          this.setState({
            filters: filters,
            parameters: parameters
          })

          if (Object.keys(this.state.preLoadParams).length) {
            this.applyParameters(this.state.preLoadParams)
            this.setState({ preLoadParams: {} })
          }
          if (Object.keys(this.state.preLoadFilters).length) {
            this.applyFilters(this.state.preLoadFilters)
            this.setState({preLoadFilters: {}})
          }
        }
      })(this.props.parameters, this.props.filters)
    }

    // `undefined` options are bad times. If we were performing an update we
    // might interpret this as a "reset" on a particular filter/parameter but as
    // an initial value I'm not sure there's much value in sending an undefined
    // thing.
    Object.keys(options).forEach(key => {
      if (typeof options[key] === 'undefined') {
        delete options[key]
      }
    })

    Object.keys(options)
      .forEach(key => {
      // It's necessary to also check that it's not an array so we don't remove filters
      // In JS, typeof [] === 'object' :facepalm:
        if (typeof options[key] === 'object' && !Array.isArray(options[key])) {
          delete options[key]
        }
      })

    if (DEBUG) {
      console.log('Creating viz...')
      Object.keys(options)
        .filter(key => key !== 'onFirstInteractive')
        .forEach(key => {
          console.log('...with initial option', key, options[key])
        })
    }

    if (this.viz) {
      this.viz.dispose()
      this.viz = null
      this.workbook = null
    }

    this.getTableau()
      .then(Tableau => {
        this.viz = new Tableau.Viz(this.container, trustedUrl, options)
      })
      .catch(reason => {
        console.error(reason)
      })
  }

  /**
   * Gets the trusted URL for the Tableau view and initializes the viz
   */
  initTrustedView () {
    const { url, user, tableauTrustedUrl } = this.props

    // If no user is provided just try to load the dashboard as is
    if (!user) {
      let dashUrl = url
      if (DEBUG) {
        dashUrl += '&:record_performance=yes&:refresh'
      }
      this.initTableau(dashUrl)
      return
    }

    fetch(`${tableauTrustedUrl}?user=${user}&url=${url}`, fetchOpts)
      .then(resp => {
        // No-Content responses will fail json decoding
        // because they have no body. They should just resolve
        // with no data
        if (resp.status === HTTP_STATUS_NOCONTENT) {
          return Promise.resolve()
        }
        return resp.json().then(json => {
          if (resp.ok) {
            return json
          }
          let err = new Error(`Request to ${url} failed with status ${resp.status}`)
          err.httpStatusCode = resp.status
          return Promise.reject(err)
        })
      })
      .then((responseData) => {
        let dashUrl = `${responseData.data.id}&:revert=filters`
        if (DEBUG) {
          dashUrl += '&:record_performance=yes&:refresh'
        }
        this.initTableau(dashUrl)
      })
      .catch(reason => {
        if (reason.hasOwnProperty('httpStatusCode') &&
          reason.httpStatusCode === 401) {
          this.setState({ error: ERROR_PERMISSIONS })
        } else {
          this.setState({ error: ERROR_GENERIC })
        }
        console.error(reason)
      })
  }

  applyFilters (filters) {
    // If we don't have a workbook yet, save these to be applied on initial load
    if (!(this.workbook && this.viz)) {
      return this.setState({
        preLoadFilters: {
          ...this.state.preLoadFilters,
          ...filters
        }
      })
    }

    // Perform all filter changes in a batch by pausing automatic updates,
    // applying all filters, and resuming automatic updates
    getPromiseFromTableauPromise(this.viz.pauseAutomaticUpdatesAsync())
      .then(() => Promise.all(this.applyFiltersHelper(filters)))
      .then(() => getPromiseFromTableauPromise(this.viz.resumeAutomaticUpdatesAsync()))
      .catch(err => {
        console.error(err)
        // Tableau sometimes throws "invalidFilterFieldValue" errors for
        // filters that don't match any records. Just try to resume updates
        // so that the dashboard is not locked up.
        this.viz.resumeAutomaticUpdatesAsync()
      })
  }

  applyFiltersHelper (filters) {
    const filterPromises = []

    const Tableau = this.getTableauSyncUnsafe()
    // If the active sheet is already a worksheet, apply the filters to it.
    // Otherwise if it is a dashboard we have to extract its worksheets and
    // apply the filters to each
    const sheets = []
    if (this.activeSheet instanceof Tableau.Worksheet) {
      sheets.push(this.activeSheet)
    } else {
      Array.prototype.push.apply(sheets, this.activeSheet.getWorksheets())
    }

    const clearFilter = (filterKey) => {
      sheets.forEach(ws => filterPromises.push(getPromiseFromTableauPromise(ws.applyFilterAsync(filterKey, '', Tableau.FilterUpdateType.ALL))))
    }

    for (const key in filters) {
      const filterValue = filters[key]

      if (!this.state.filters.hasOwnProperty(key) ||
        filterValue !== this.state.filters[key]) {
        if (DEBUG) {
          console.log(
            'Setting Tableau filter',
            key,
            filterValue,
            `(was ${this.state.filters[key]})`
          )
        }
        if (!filterValue.length) {
          clearFilter(key)
        } else {
          sheets.forEach(ws => {
            filterPromises.push(getPromiseFromTableauPromise(
              ws.applyFilterAsync(
                key,
                filterValue,
                Tableau.FilterUpdateType.REPLACE
              )
            ))
          })
        }
      }
    }

    // If any filters that were previously applied are no longer present in the
    // list of filters, clear them out
    for (const key in this.state.filters) {
      if (!filters.hasOwnProperty(key)) {
        if (DEBUG) {
          console.log(
            'Clearing Tableau filter',
            key,
            `(was ${this.state.filters[key]})`
          )
        }
        clearFilter(key)
      }
    }

    this.setState({ filters })

    return filterPromises
  }

  applyParameters (parameters) {
    // If we don't have a workbook yet, save these to be applied on initial load
    if (!(this.workbook && this.viz)) {
      this.setState({
        preLoadParams: {
          ...this.state.preLoadParams,
          ...parameters
        }
      })
      return
    }
    for (const key in parameters) {
      if (!this.state.parameters.hasOwnProperty(key) ||
        parameters[key] !== this.state.parameters[key]) {
        if (DEBUG) {
          console.log(
            'Setting Tableau parameter',
            key,
            parameters[key],
            `(was ${this.state.parameters[key]})`
          )
        }
        this.workbook.changeParameterValueAsync(key, parameters[key])
      }
    }
    this.setState({ parameters })
  }

  meetsStandardWidth () {
    // Return true while the size of the viz is still unknown
    if (Object.keys(this.state.maxSize).length === 0 || Object.keys(this.state.minSize).length === 0) {
      return true
    }
    return this.state.maxSize.width >= STANDARD_MAX_WIDTH &&
      this.state.minSize.width <= STANDARD_MIN_WIDTH
  }

  downloadWorkbook () {
    this.viz.showDownloadWorkbookDialog()
  }

  render () {
    const {
      url,
      user,
      tableauTrustedUrl,
      filters,
      filterTypes,
      parameters,
      checkDashboardDimensions,
      hideToolbar, // Unused, but omitted from `dashboardProps`
      onDashboardLoad, // Unused, but omitted from `dashboardProps`
      ...dashboardProps
    } = this.props
    return (
      <div>
        <iframe src='https://ivantage.github.io/3rdpartycookiecheck/start.html'
          title='Third-party cookie check'
          style={{ display: 'none' }} />
        {!this.state.thirdPartyCookiesEnabled &&
          <p className='au-text-warning'>
            You need to have third-party cookies enabled in order to view dashboards
            properly. Please make sure that your browser settings are configured to allow
            third-party cookies and try refreshing this page.
          </p>
        }
        {this.state.error !== ERROR_NONE &&
          <p className='au-text-warning'>
            {ERROR_MESSAGES[this.state.error]}
          </p>
        }
        <div ref={c => (this.container = c)} {...dashboardProps} />
      </div>
    )
  }

  componentDidMount () {
    this.initTrustedView()
    window.addEventListener('message', this.messageEventListener)
  }

  /**
   * Reinitialize the Tableau view if the view URL or user
   * accessing it changed
   */
  componentDidUpdate (prevProps) {
    const isInitNeeded = prevProps.url !== this.props.url ||
      prevProps.user !== this.props.user
    if (isInitNeeded) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ error: ERROR_NONE })
      this.initTrustedView()
    }
  }

  componentWillReceiveProps (nextProps) {
    const isSameUrl = nextProps.url === this.props.url
    const isFiltersNew = nextProps.filters !== this.props.filters ||
      nextProps.filterTypes !== this.props.filterTypes
    const isParamsNew = nextProps.parameters !== this.props.parameters
    if (isSameUrl && isParamsNew) {
      this.applyParameters(nextProps.parameters)
    }

    if (isSameUrl && isFiltersNew) {
      this.applyFilters(nextProps.filters, nextProps.filterTypes)
    }
  }

  /**
   * Cleanup event listeners when the component unmounts
   */
  componentWillUnmount () {
    if (this.resizeListening) {
      window.removeEventListener('resize', this.resizeEventListener)
      window.removeEventListener('message', this.messageEventListener)
    }
  }
}

IvhTableauDashboard.propTypes = propTypes
IvhTableauDashboard.defaultProps = defaultProps

export default IvhTableauDashboard
