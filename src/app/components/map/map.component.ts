import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { GoogleMap, GoogleMapsModule } from '@angular/google-maps';
import { GisService } from '../../services/gis.service';
import { JsonApiService } from '../../services/json-api.service';
// import { MessageService } from 'primeng/api';
import { finalize, forkJoin, tap } from 'rxjs';

@Component({
    selector: 'app-map',
    standalone: true,
    imports: [CommonModule, GoogleMapsModule],
    templateUrl: './map.component.html',
    styleUrl: './map.component.scss',
})
export class MapComponent {
    center: google.maps.LatLngLiteral;
    zoom = 12;
    currentZoom: number = this.zoom;
    markerClustererImagePath = 'assets/img/map/cluster/m';
    //- 是否顯示 cluster
    isUseCluster = true;

    // 攝影機列表
    cctvList = [];
    // 機箱列表
    boxList = [];
    apiLoaded: boolean;

    showCluster = false;
    // 機箱標記識別
    caseMarkerType = '99';
    selectMarkTypes = ['99'];
    //- 地圖預設
    mapOptions: google.maps.MapOptions;

    //- 是否正在繪製圓形
    isDrawing = false;
    //- 繪製中的圓形
    tempCircle = { center: { lat: 0, lng: 0 }, radius: 0, options: {} };
    //- 地圖圈選
    circles: {
        center: google.maps.LatLngLiteral;
        radius: number;
        options: any;
        label: string;
        address?: string;
    }[] = [];
    //- 檢視明細的marker
    selectedMarker = [];
    //- 地圖圖層選項
    regionActiveSec = 1;
    regionSelector = [
        { header: '行政區域', dataKey: 'district' },
        { header: '分局轄境', dataKey: 'bureau' },
    ];
    //- 範圍繪製點位
    polygonsList: google.maps.LatLngLiteral[][] = [];
    //- 所選繪製區域
    selectedArea: any;
    //- 圖片彈窗
    imgDialog = {
        isOpen: false,
        imgUrl: null,
    };
    //- 攝影機資訊彈窗欄位
    cctvInfoField: { [key: string]: string }[];
    //- 機箱資訊彈窗欄位
    camBoxInfoField: { [key: string]: string }[];
    //- 螢幕寬度
    screenWidth: number = window.innerWidth;
    //- 側邊欄
    sidebarVisible: boolean;
    //- loading
    loading: boolean;

    @ViewChild('mapRef') map!: GoogleMap;

    constructor(
        public gisService: GisService,
        public jsonApiService: JsonApiService,
    ) {
        this.initInfoWindow();
        this.center = this.gisService.defaultCenter;
    }

    ngOnInit(): void {
        this.initMapView();
        this.initPage();
        //- RWD
        window.addEventListener('resize', () => {
            this.screenWidth = window.innerWidth;
        });

        //- 地圖行動指令監聽
        this.gisService.mapAction$.subscribe(res => {
            if (!res) return;
            switch (res.type) {
                case 'add-circle':
                    this.addCircle(res.data);
                    this.center = res.data.center;
                    break;
                case 'delete-circle':
                    this.deleteCircle(res.data);
                    break;
                case 'clear':
                    this.clearMapDraw();
                    break;
            }
        });
    }

    ngOnDestroy(): void {
        this.gisService.mapAction$.unsubscribe();
    }

    /** 頁面初始資料載入 */
    initPage() {}

    /** 地圖點擊處理 */
    mapHandleClick(event: google.maps.MapMouseEvent) {
        switch (this.gisService.mapEditType) {
            case 'circle':
                this.addCircleFromClick(event);
                break;
            default:
                return;
        }
    }

    /** 地圖滑鼠移動處理 */
    mapMouseMove(event: google.maps.MapMouseEvent) {
        switch (this.gisService.mapEditType) {
            case 'circle':
                this.drawingCircle(event);
                break;
            default:
                return;
        }
    }

    /** 移動至目標視野 */
    setBoundary(data) {
        if (this.map) {
            // 邊界範圍
            const bounds = new google.maps.LatLngBounds(
                new google.maps.LatLng(data[0], data[2]), // 南西角
                new google.maps.LatLng(data[1], data[3]), // 東北角
            );
            this.map.fitBounds(bounds);
        }
    }

    /** 選取Marker */
    focusMarker(target) {
        this.center = { lat: target.Latitude, lng: target.Longitude }; // 更新中心點 (台北 101)
        this.zoom = 18; // 更新縮放級別
    }

    /** 清除畫面 */
    clearMapDraw() {
        this.circles = [];
    }

    sidebarToggle() {
        this.sidebarVisible = !this.sidebarVisible;
        if (!this.sidebarVisible) {
            this.gisService.mapEditType = null;
            this.clearMapDraw();
        }
    }
    /* -------------------------------------------------------------------------- */
    /*                                  資訊窗相關                                  */
    /* -------------------------------------------------------------------------- */
    /** 開啟或關閉 InfoWindow */
    toggleInfoWindow(marker, type: 'cctv' | 'chassis') {
        const key = type === 'chassis' ? 'ChassisId' : 'CCTVId';

        const index = this.selectedMarker.findIndex(
            item => item[key] == marker[key],
        );

        if (index > -1) {
            this.selectedMarker.splice(index, 1);
        } else {
            const posDiff = this.selectedMarker.length * 15;
            this.selectedMarker.push({
                ...marker,
                isOpen: true,
                x: posDiff + 450,
                y: posDiff + 80,
            });
        }
    }

    /** 更新windowInfo位置 */
    updateDialogPosition(marker, event) {
        marker.left = event.left;
        marker.top = event.top;
    }

    /** 開啟圖片彈窗（場刊圖） */
    openImgDialog(imgUrl: string) {
        console.log('imgUrl', imgUrl);
        this.imgDialog = {
            isOpen: true,
            imgUrl,
        };
    }

    /** InfoWindow 欄位初始設定 */
    initInfoWindow() {
        this.cctvInfoField = [
            { fieldName: '轄區', key: 'DeptName' },
            { fieldName: '攝影機編號', key: 'CCTVId' },
            { fieldName: '攝影機名稱', key: 'Name' },
            { fieldName: '方向', key: 'Direction' },
            { fieldName: '場勘圖', key: 'Image' },
            { fieldName: '狀態', key: 'CameraStatus' },
            { fieldName: '報修', key: 'RepairBtn' },
        ];
        this.camBoxInfoField = [
            { fieldName: '轄區', key: 'DeptName' },
            { fieldName: '機箱編號', key: 'ChassisId' },
            { fieldName: '機箱名稱', key: 'Name' },
            { fieldName: '場勘圖', key: 'Image' },
            { fieldName: '狀態', key: 'Status' },
            { fieldName: '即時影像', key: 'CamIds' },
            { fieldName: '機箱報修', key: 'RepairBtn' },
        ];
    }

    /* -------------------------------------------------------------------------- */
    /*                                  地圖繪製圓圈範圍                               */
    /* -------------------------------------------------------------------------- */
    /** 地圖滑鼠移動處理 */
    drawingCircle(event: google.maps.MapMouseEvent) {
        if (this.isDrawing && event.latLng) {
            const latLng = event.latLng;
            const center = new google.maps.LatLng(
                this.tempCircle.center.lat,
                this.tempCircle.center.lng,
            );
            const movingPoint = new google.maps.LatLng(
                latLng.lat(),
                latLng.lng(),
            );

            // 使用 Google Maps API 計算距離
            const radius =
                google.maps.geometry.spherical.computeDistanceBetween(
                    center,
                    movingPoint,
                );

            this.tempCircle.radius = radius;
        }
    }

    /** 地圖縮放 */
    checkZoom() {
        if (this.map) {
            this.currentZoom = this.map.getZoom();
        }
    }

    /** 地圖點擊圈選 */
    addCircleFromClick(event: google.maps.MapMouseEvent) {
        if (!this.isDrawing) {
            // 第一次點擊 -> 設定圓形中心點
            if (event.latLng) {
                this.tempCircle.center = {
                    lat: event.latLng.lat(),
                    lng: event.latLng.lng(),
                };
                this.tempCircle.radius = 0;
                this.tempCircle.options = {
                    fillColor: 'rgba(0, 0, 0, 0.3)',
                    strokeColor: '#555',
                    strokeWeight: 2,
                    clickable: false,
                };
                this.isDrawing = true;
            }
        } else {
            // 第二次點擊 -> 確認圓形並儲存
            const firstNullIndex = this.circles.findIndex(
                item => item === null,
            );
            const targetIndex =
                firstNullIndex >= 0 ? firstNullIndex : this.circles.length;

            this.isDrawing = false; // 停止繪製
            const newCircleData = {
                ...this.tempCircle,
                index: targetIndex,
            };
            this.addCircle(newCircleData);
            // 取得地址
            const finalCenter = this.tempCircle.center;
            this.gisService
                .getAddress(finalCenter.lat, finalCenter.lng)
                .then((address: string) => {
                    this.gisService.panelAction$.next({
                        type: 'add-circle',
                        data: { ...newCircleData, address },
                    });
                });
        }
    }

    /** 新增圓圈 */
    addCircle(data) {
        const { index, center, radius } = data;
        this.circles[index] = {
            label: (index + 1).toString(),
            center,
            radius,
            options: {
                fillColor: 'rgba(255, 0, 0, 0.3)',
                strokeColor: '#FF0000',
                strokeWeight: 2,
                clickable: false,
                zIndex: 9999,
            },
        };
    }

    /** 刪除圓圈 */
    deleteCircle(index) {
        if (this.circles[index]) this.circles[index] = null;
    }

    /* -------------------------------------------------------------------------- */
    /*                                  行政區範圍繪製                               */
    /* -------------------------------------------------------------------------- */
    drawRegionArea(mapIds: string[], onlyMove = false) {
        this.polygonsList = [];
        this.loading = true;

        const mapDataSub$ = mapIds.map(mapId =>
            this.jsonApiService.fetch(`/mapData/${mapId}.json`),
        );

        forkJoin(mapDataSub$)
            .pipe(
                tap(resAll => {
                    resAll.forEach(res => {
                        if (!res?.geojson?.coordinates) return;
                        if (!onlyMove)
                            res.geojson.coordinates.forEach(coordinate => {
                                const polygon = coordinate.map(point => {
                                    return {
                                        lng: point[0],
                                        lat: point[1],
                                    };
                                });

                                this.polygonsList.push(polygon);
                            });
                    });
                    if (resAll[0]?.boundingbox)
                        this.setBoundary(resAll[0].boundingbox);
                }),
                finalize(() => (this.loading = false)),
            )
            .subscribe();
    }

    /* -------------------------------------------------------------------------- */
    /*                                  Map設定                                    */
    /* -------------------------------------------------------------------------- */
    /** 地圖初始化 */
    initMapView() {
        this.initMapOption();
        console.log('init');
        this.gisService.loadMapView().subscribe((res: boolean) => {
            this.apiLoaded = res;
        });
    }

    /** 地圖設定 */
    initMapOption() {
        this.mapOptions = {
            disableDefaultUI: true, // 隱藏 Google 地圖的內建 UI 控制（避免用戶點擊地標）
            zoomControl: true, // 縮放控制
            streetViewControl: true, // 街景服務
            mapTypeControl: true, // 地圖類型（衛星地圖選單）
            mapTypeControlOptions: {
                position: 20.0, // 設定地圖類型控制到左上角
            },
            clickableIcons: false, // 防止用戶點擊 POI 地標
            styles: [
                {
                    featureType: 'poi', // 隱藏所有 POI（地標）
                    elementType: 'all',
                    stylers: [{ visibility: 'off' }],
                },
                {
                    featureType: 'transit', // 隱藏所有大眾運輸標記（如捷運、公車站）
                    elementType: 'all',
                    stylers: [{ visibility: 'off' }],
                },
            ],
        };
    }
}
