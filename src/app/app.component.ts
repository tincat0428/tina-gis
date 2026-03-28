import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { GoogleMapsModule } from '@angular/google-maps';
import { HttpClientModule, HttpClientJsonpModule } from '@angular/common/http';
import { MapComponent } from './components/map/map.component';
import { ToastModule } from 'primeng/toast';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [
        RouterOutlet,
        CommonModule,
        GoogleMapsModule,
        HttpClientModule,
        HttpClientJsonpModule,
        ButtonModule,
        MapComponent,
        ToastModule,
    ],
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
})
export class AppComponent {
    title = 'tina-gis';
}
