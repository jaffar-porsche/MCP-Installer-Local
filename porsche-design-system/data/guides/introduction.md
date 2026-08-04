# Start Coding
Porsche Design System provides developers with versioned packages of Web components, Angular components, React components and Vue components to build clean and high-quality frontends that innately come with the latest design definitions.

## Quick start in Angular
To build your own application with the Angular components of Porsche Design System, follow these steps:

- Install the Porsche Design System Angular components using `npm install @porsche-design-system/components-angular`
- Think of a name for your project and create it using `ng new [APP_NAME]`
- Add the Porsche Design System to your Angular project

You are now ready to start building your own application.

## Integration
After adding the @porsche-design-system/components-angular package to your project, you've to import the PorscheDesignSystemModule in every module you want to use the components.

The following setup is a standard Angular 19 CLI project:

```
// app.module.ts

import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { PorscheDesignSystemModule } from '@porsche-design-system/components-angular';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, PorscheDesignSystemModule], // <-- PDS module is imported here
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

Change your app component to use at least one Porsche Design System component, for example:

```
// app.component.ts

import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `<p-heading>Welcome to Angular</p-heading>`,
  changeDetection: ChangeDetectionStrategy.OnPush, // disable automatic change detection, https://angular.io/api/core/ChangeDetectionStrategy
})
export class AppComponent {}
```

Run `npm start` and check if the components are displayed correctly.

## Using Standalone Components
When using Standalone Components, the PorscheDesignSystemModule needs to be included in the component itself.

```
// app.component.ts (standalone)

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PorscheDesignSystemModule } from '@porsche-design-system/components-angular';

@Component({
selector: 'app-root',
  standalone: true,
  imports: [PorscheDesignSystemModule], // <-- PDS module is imported here
  template: `<p-heading>Welcome to Angular</p-heading>`,
changeDetection: ChangeDetectionStrategy.OnPush, // disable automatic change detection, https://angular.io/api/core/ChangeDetectionStrategy
})
export class AppComponent {}
```