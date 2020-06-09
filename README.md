# ivh-react-tableau

> Tableau React components

[![NPM](https://img.shields.io/npm/v/ivh-react-tableau.svg)](https://www.npmjs.com/package/ivh-react-tableau) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

## Install

```bash
npm install --save ivh-react-tableau
```

## Usage

```jsx
import React, { Component } from 'react'

import IvhTableauDashboard from 'ivh-react-tableau'

class Example extends Component {
  render() {
    return (
      <IvhTableauDashboard url='http://public.tableau.com/views/RegionalSampleWorkbook/College'
        filters={{
          'Academic Year': '2013'
        }} />
    )
  }
}
```

## License

MIT © iVantage Health Analytics
