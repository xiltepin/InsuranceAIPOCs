import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ImageUploaderComponent } from './components/image-uploader/image-uploader.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ImageUploaderComponent],
  template: `
    <router-outlet></router-outlet>
  `,
})
export class App {}