import React from 'react'

import IvhTableauDashboard from 'ivh-react-tableau'
import 'ivh-react-tableau/dist/index.css'

const App = () => {
  return (
    <IvhTableauDashboard
      url='https://public.tableau.com/views/RegionalSampleWorkbook/College'
      filters={{
        'Academic Year': '2013'
      }}
    />
  )
}

export default App
