# ivh-react-tableau

> React components for embedding Tableau dashboards

[![NPM](https://img.shields.io/npm/v/ivh-react-tableau.svg)](https://www.npmjs.com/package/ivh-react-tableau) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Install

```bash
npm install --save ivh-react-tableau
```

## Usage

Before using this component you need to provide the Tableau JS API by adding
it to your `index.html`.

```html
<script src="https://public.tableau.com/javascripts/api/tableau-2.min.js"></script>
```

Load it!

```js
import IvhTableauDashboard from 'ivh-react-tableau'
```

Use it!

```jsx
<IvhTableauDashboard url='http://public.tableau.com/views/RegionalSampleWorkbook/College'
  filters={{
    'Academic Year': '2013'
  }} />
}
```

### Properties

- `url` _(required)_ - The full URL of the Tableau view to embed
- `user` - If using trusted authentication, the Tableau user to request a trusted ticket as. If
  not provided then trusted authentication will not be attempted.
- `trustedTicketUrl` - The API endpoint used to grant trusted tickets. The API should behave the
  same was as Tableau's ticket granting API as described here: https://help.tableau.com/current/server/en-us/trusted_auth_webrequ.htm
- `filters` - A hash of tableau filters to apply to the dashboard.
  Changes will be applied to the dashboard as this prop is updated.
- `parameters` - A hash of tableau parameters to apply to the dashboard.
  Changes will be applied to the dashboard as this prop is updated.
- `onDashboardLoad` - An optional callback function which is called during the dashboard's
  `onFirstInteractive` event. The callback is passed the viz's workbook as a parameter.

Additional [options](https://help.tableau.com/current/api/js_api/en-us/JavaScriptAPI/js_api_ref.htm#vizcreateoptions_record) can be passed to the Tableau initializer
by specifying additional attributes on the `IvhTableauDashboard` tag. e.g. `<IvhTableauDashboard ... height='500px' hideTabs />`

## Development

This package was bootstrapped with [create-react-library](https://www.npmjs.com/package/create-react-library)
and follows its local development pattern. This is broken into two parts: the module itself, and the example
application. To start local development:

1. Run `npm start` in the repository root to build and watch the source module
2. In a second terminal `cd` into the `example` folder and run `npm start`

## License

MIT © iVantage Health Analytics
