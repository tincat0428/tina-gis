import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';

import { routes } from './app.routes';
import { provideHttpClient, withJsonpSupport } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
    providers: [
        provideHttpClient(withJsonpSupport()),
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideRouter(routes),
        provideAnimationsAsync(),
        providePrimeNG({
            theme: {
                preset: Aura,
                options: {
                    darkModeSelector: '.none', // 將選擇器設為無效，防止自動切換
                }
            },
        }),
    ],
};
