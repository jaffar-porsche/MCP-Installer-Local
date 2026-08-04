import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PorscheDesignSystemModule, type AccordionUpdateEventDetail } from '@porsche-design-system/components-angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, PorscheDesignSystemModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'Porsche Dashboard';

  // Track open state for each accordion by heading
  accordionStates: { [key: string]: boolean } = {};

  // Check if a specific accordion is open
  isAccordionOpen(heading: string): boolean {
    return this.accordionStates[heading] || false;
  }

  // Update handler for accordions
  onUpdate(e: CustomEvent<AccordionUpdateEventDetail>, heading: string) {
    this.accordionStates[heading] = e.detail.open;
  }
}
