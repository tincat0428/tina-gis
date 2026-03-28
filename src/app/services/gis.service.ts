import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
    BehaviorSubject,
    catchError,
    map,
    Observable,
    of,
    shareReplay,
    tap,
} from 'rxjs';
import { DropDownListModel, MapActionType } from '../model/gis';

const GOOGLE = 'AIzaSyBj1eqR5T03-v52epF1leMMXeoTkwNXadw';

@Injectable({
    providedIn: 'root',
})
export class GisService {
    constructor(private http: HttpClient) {
        this.region$ = this.http
            .get<{
                district: DropDownListModel[];
                bureau: DropDownListModel[];
            }>('/mapData/region.json')
            .pipe(
                catchError(() => of(null)),
                shareReplay(1),
            );
    }

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
    panelAction$ = new BehaviorSubject<{ type: MapActionType; data?}>(null);
    //- 對 map 執行動作
    mapAction$ = new BehaviorSubject<{ type: MapActionType; data?}>(null);

    //- Marker 尺寸
    get markerSize(): google.maps.Size {
        return new google.maps.Size(40, 40);
    }
    get markerCenter(): google.maps.Point {
        return new google.maps.Point(20, 20);
    }

    //- 攝影機類別清單（可由外部注入）
    cameraTypeList$ = new BehaviorSubject<DropDownListModel[]>([]);

    //- 查詢選項（待接 API 填入）
    bureauOptions$ = new BehaviorSubject<DropDownListModel[]>([]);
    stationOptions$ = new BehaviorSubject<DropDownListModel[]>([]);
    districtOptions$ = new BehaviorSubject<DropDownListModel[]>([]);
    villageOptions$ = new BehaviorSubject<DropDownListModel[]>([]);

    //- 地域範圍匡選對應（從 /mapData/region.json 取得）
    region$: Observable<{
        district: DropDownListModel[];
        bureau: DropDownListModel[];
    } | null>;

    /**
     * GoogleMap 初始化（包含 geometry library）
     */
    loadMapView(): Observable<boolean> {
        if (window.google && window.google.maps) {
            return of(true);
        }

        return this.http
            .jsonp(
                `https://maps.googleapis.com/maps/api/js?key=${GOOGLE}&libraries=geometry`,
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
        return new Promise(resolve => {
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
                    componentRestrictions: { country: 'TW' },
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

    // INFO: 以下為 API stub，待接後端 ***********************************

    /** 取得攝影機列表 */
    getMonitorList(params?: any): Observable<any> {
        return of({ body: { Detail: [] } });
    }

    /** 取得機箱列表 */
    getChassisList(params?: any): Observable<any> {
        return of({ body: { Detail: [] } });
    }

    /** 取得斷線攝影機 */
    getDisconnectedCams(): Observable<any> {
        return of({ body: [] });
    }

    /** 更新攝影機位置 */
    updateMonitorPosition(params: any): Observable<any> {
        return of({ code: '000' });
    }
}
