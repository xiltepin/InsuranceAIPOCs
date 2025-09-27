import { Routes } from '@angular/router';
import { ImageUploaderComponent } from './components/image-uploader/image-uploader.component';
import { HomeComponent } from './components/home.component';

export const routes: Routes = [
	{ path: '', component: HomeComponent },
	{ path: 'OCRAuto', component: ImageUploaderComponent },
];
