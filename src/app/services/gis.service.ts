import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, map, Observable, of, tap } from 'rxjs';
import { MapActionType } from '../model/gis';

const GOOGLE = 'AIzaSyDO8CqY1zfV8IW7hvwtf3P_QdlTI0t0ffQ';

@Injectable({
    providedIn: 'root',
})
export class GisService {
    constructor(private http: HttpClient) {}

    //- Geocoder API
    geocoder: google.maps.Geocoder;

    //- 地圖預設設定
    defaultCenter: google.maps.LatLngLiteral = {
        lat: 24.9837,
        lng: 121.2,
    };

    //- 地圖編輯模式
    mapEditType: 'circle' | null = null;

    //- 對 panel 執行動作
    panelAction$ = new BehaviorSubject<{ type: MapActionType; data? }>(null);
    //- 對 map 執行動作
    mapAction$ = new BehaviorSubject<{ type: MapActionType; data? }>(null);

    //- 地域範圍匡選對應
    // region$ = this.jsonApiService.fetch('/mapData/region.json').pipe(
    //   map((res) => this.errorCatchService.getError(res, 'region')),
    //   map((res) => res.body),
    //   catchError((x) => {
    //     this.errorCatchService.isCatchErrCode(x, 'region');
    //     return of();
    //   }),
    //   shareReplay(1)
    // );

    /**
     * GoogleMap 初始化
     */
    loadMapView(): Observable<boolean> {
        // 檢查 API 是否已經加載過
        if (window.google && window.google.maps) {
            // API 已加載過，直接返回
            return of(true);
        }

        return this.http
            .jsonp(
                `https://maps.googleapis.com/maps/api/js?key=${GOOGLE}`,
                'callback',
            )
            .pipe(
                map(() => true),
                tap(() => (this.geocoder = new google.maps.Geocoder())),
                catchError(error => {
                    console.log('error', error);
                    return of(false);
                }),
            );
    }

    /**
     * 透過經緯度取得地址
     */
    getAddress(lat: number, lng: number): Promise<string> {
        return new Promise((resolve, reject) => {
            this.geocoder.geocode(
                { location: { lat, lng }, language: 'zh-TW' },
                (results, status) => {
                    if (
                        status === google.maps.GeocoderStatus.OK &&
                        results[0]
                    ) {
                        resolve(results[0].formatted_address);
                    } else {
                        resolve('地址未找到');
                    }
                },
            );
        });
    }

    /**
     * 透過地址取得經緯度
     */
    getPositionFromAddr(
        address: string,
    ): Promise<{ lat: number; lng: number }> {
        return new Promise((resolve, reject) => {
            this.geocoder.geocode(
                {
                    address,
                    componentRestrictions: {
                        country: 'TW',
                    },
                },
                (results, status) => {
                    if (
                        status === google.maps.GeocoderStatus.OK &&
                        results[0]
                    ) {
                        resolve({
                            lat: results[0].geometry.location.lat(),
                            lng: results[0].geometry.location.lng(),
                        });
                    } else {
                        reject('地址未找到');
                    }
                },
            );
        });
    }
}
