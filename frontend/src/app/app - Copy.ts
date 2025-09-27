import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ImageUploaderComponent } from './components/image-uploader/image-uploader.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ImageUploaderComponent],
  template: `
    <app-image-uploader></app-image-uploader>
    <router-outlet></router-outlet>
  `,
})
export class App {}