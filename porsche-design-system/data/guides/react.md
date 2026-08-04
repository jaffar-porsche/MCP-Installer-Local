## Quick start in React
To build your own application with the React components of Porsche Design System, follow these steps:

- Install typescript using `npm install typescript @types/node @types/react @types/react-dom @types/jest`
- Install the Porsche Design System React components using `npm install @porsche-design-system/components-react`
- Think of a name for your project and create it using using `yarn create react-app [APP_NAME] --template typescript`

You are now ready to start building your own application.

## Integration
The following project is a standard React (Create React App) setup extended by the necessary PorscheDesignSystemProvider.

```
// index.tsx

import ReactDOM from 'react-dom';
import { PorscheDesignSystemProvider } from '@porsche-design-system/components-react';
import './index.css';
import { App } from './App';

ReactDOM.render(
  <React.StrictMode>
    <PorscheDesignSystemProvider>
      <App />
    </PorscheDesignSystemProvider>
  </React.StrictMode>,
  document.getElementById('root')
);
```

Change your App file to use at least one Porsche Design System component, for example:
```
// App.tsx

import { PHeading } from '@porsche-design-system/components-react';

export const App = (): JSX.Element => (
  <div className="App">
    <PHeading>Welcome to React</PHeading>
  </div>
);
```
Run ```npm start``` and check if the components are displayed correctly.


When you look at the result in your browser you should see an error message like The Porsche Design System is used without using the getInitialStyles() partial.
To fix this, you have to apply the getInitialStyles() partial.