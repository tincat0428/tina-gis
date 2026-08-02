import { CommonModule } from '@angular/common';
import {
    Component,
    HostListener,
    OnDestroy,
    OnInit,
    ViewChild,
} from '@angular/core';
import {
    FormBuilder,
    FormGroup,
    FormsModule,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { GoogleMap, GoogleMapsModule, MapCircle } from '@angular/google-maps';
import { MenuItem, MessageService } from 'primeng/api';
import { forkJoin, of } from 'rxjs';
import { finalize, tap } from 'rxjs/operators';
/*-- PrimeNG --*/
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { ContextMenu, ContextMenuModule } from 'primeng/contextmenu';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { Popover, PopoverModule } from 'primeng/popover';
import { ToastModule } from 'primeng/toast';
/*-- Sub-components --*/
import { MapPanelComponent } from './panel/panel.component';
import { MapVideoComponent } from './map-video/map-video.component';
/*-- Services & Models --*/
import { GisService } from '../../services/gis.service';
import { JsonApiService } from '../../services/json-api.service';
import {
    BoxMarker,
    CctvMarker,
    DropDownListModel,
    GisCircleType,
    PersonalMarker,
} from '../../model/gis';

type VideoDialogMode = 'realtime' | 'history';

@Component({
    selector: 'app-map',
    standalone: true,
    providers: [MessageService],
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        GoogleMapsModule,
        ButtonModule,
        CheckboxModule,
        ContextMenuModule,
        DialogModule,
        InputNumberModule,
        InputTextModule,
        PopoverModule,
        ToastModule,
        MapPanelComponent,
        MapVideoComponent,
    ],
    templateUrl: './map.component.html',
    styleUrl: './map.component.scss',
})
export class MapComponent implements OnInit, OnDestroy {
    center: google.maps.LatLngLiteral;
    zoom = 12;
    currentZoom: number = this.zoom;
    markerClustererImagePath = 'assets/img/map/cluster/m';

    // 攝影機列表
    cctvList: CctvMarker[] = [];
    // 機箱列表
    boxList: BoxMarker[] = [];
    apiLoaded = false;
    loading = false;

    //- 機箱標記識別
    caseMarkerType = '99';
    //- 選擇顯示的設備類型
    selectMarkTypes: string[] = [this.caseMarkerType];
    //- 攝影機類型清單
    cameraTypeList: DropDownListModel[] = [];
    //- 地圖設定
    mapOptions: google.maps.MapOptions;

    //- 是否正在繪製圓形
    isDrawing = false;
    //- 繪製中的圓形
    tempCircle = { center: { lat: 0, lng: 0 }, radius: 0, options: {} };
    //- 繪製中的半徑是否已被上限截斷
    radiusCapped = false;
    //- 地圖圈選
    circles: {
        center: google.maps.LatLngLiteral;
        radius: number;
        options: any;
        label: string;
        address?: string;
    }[] = [];

    //- 軌跡繪製點位
    routeWaypoints: (google.maps.LatLngLiteral | null)[] = new Array(8).fill(null);
    //- 軌跡繪製結果
    directionsResult: google.maps.DirectionsResult | null = null;
    private directionsService: google.maps.DirectionsService;

    //- 檢視明細的 marker
    selectedMarker: any[] = [];
    //- 範圍繪製點位
    polygonsList: google.maps.LatLngLiteral[][] = [];

    //- 圖片彈窗
    imgDialog = { isOpen: false, imgUrl: null as string | null };
    //- 攝影機資訊彈窗欄位
    cctvInfoField: { fieldName: string; key: string }[];
    //- 機箱資訊彈窗欄位
    camBoxInfoField: { fieldName: string; key: string }[];

    //- 螢幕寬度
    screenWidth: number = window.innerWidth;
    //- 側邊欄
    sidebarVisible = true;

    //- 播放清單
    videoDialogTitleMap: Record<VideoDialogMode, string> = {
        history: '調閱清單',
        realtime: '即時播放清單',
    };
    videoDialog: {
        mode: VideoDialogMode;
        isOpen: boolean;
        cameraList: Record<VideoDialogMode, CctvMarker[]>;
    } = {
            mode: 'realtime',
            isOpen: false,
            cameraList: { realtime: [], history: [] },
        };

    //- 右鍵選單
    contextMenuItems: MenuItem[] = [];
    //- Marker 光暈遮罩
    circleOverlays: google.maps.OverlayView[] = [];

    //- 個人標記列表
    favoriteMarkerList: PersonalMarker[] = [];
    //- 新增個人標記彈窗
    favoriteMarkerDialog: { isOpen: boolean; form: FormGroup };
    //- 個人標記 icon 清單
    favoriteMarkerIcons = [
        'spade',
        'club',
        'heart',
        'diamond',
        'rook',
        'bishop',
        'knight',
        'star',
        'king',
        'queen',
    ];

    //- 攝影機位置編輯彈窗
    camLocationDialog: {
        isOpen: boolean;
        targetMarker: CctvMarker | null;
        form: FormGroup;
    };

    @ViewChild('mapRef') map!: GoogleMap;
    @ViewChild('contextMenu') contextMenu!: ContextMenu;
    @ViewChild(MapPanelComponent) mapPanel!: MapPanelComponent;

    constructor(
        private formBuilder: FormBuilder,
        public gisService: GisService,
        public jsonApiService: JsonApiService,
        private messageService: MessageService,
    ) {
        this.favoriteMarkerDialog = {
            isOpen: false,
            form: this.formBuilder.group({
                Name: ['', Validators.required],
                Icon: ['', Validators.required],
                Latitude: [null],
                Longitude: [null],
            }),
        };
        this.camLocationDialog = {
            isOpen: false,
            targetMarker: null,
            form: this.formBuilder.group({
                Direction: [
                    null,
                    [Validators.required, Validators.min(0), Validators.max(360)],
                ],
                Latitude: [null, Validators.required],
                Longitude: [null, Validators.required],
            }),
        };
        this.initInfoWindow();
        this.center = this.gisService.defaultCenter;
    }

    ngOnInit(): void {
        this.initMapOption();
        this.initPage();

        //- RWD
        window.addEventListener('resize', () => {
            this.screenWidth = window.innerWidth;
        });

        //- 地圖行動指令監聽
        this.gisService.mapAction$.subscribe(res => {
            if (!res) return;
            switch (res.type) {
                case 'show-halo':
                    this.showHalo(res.data);
                    break;
                case 'remove-halo':
                    this.removeAllHalos();
                    break;
                case 'add-circle':
                    this.addCircle(res.data);
                    this.focusCircle(res.data.center, res.data.radius);
                    break;
                case 'update-circle-radius':
                    this.updateCircleRadius(res.data.index, res.data.radius);
                    break;
                case 'delete-circle':
                    this.deleteCircle(res.data);
                    break;
                case 'clear-circles':
                    this.circles = [];
                    break;
                case 'highlight-circle':
                    this.highlightCircle(res.data);
                    break;
                case 'add-waypoint':
                    this.routeWaypoints[res.data.index] = res.data.position;
                    this.renderRoute();
                    break;
                case 'delete-waypoint':
                    this.routeWaypoints[res.data] = null;
                    this.renderRoute();
                    break;
                case 'reorder-waypoints':
                    this.routeWaypoints = (res.data as any[]).map(w =>
                        w.lng != null ? { lat: w.lat, lng: w.lng } : null
                    );
                    this.renderRoute();
                    break;
                case 'clear-route':
                    this.routeWaypoints = new Array(8).fill(null);
                    this.directionsResult = null;
                    break;
                case 'clear':
                    this.clearMapDraw();
                    break;
                case 'draw-region':
                    this.drawRegionArea(res.data);
                    break;
            }
        });
    }

    ngOnDestroy(): void {
        this.gisService.mapAction$.unsubscribe();
    }

    /** 頁面初始資料載入 */
    initPage() {
        this.loading = true;
        forkJoin([
            this.gisService.getMonitorList({ UsingPaging: false }),
            this.gisService.getChassisList({ UsingPaging: false }),
            this.gisService.loadMapView(),
        ])
            .pipe(
                tap(([monitorRes, chassisRes, mapLoaded]) => {
                    this.cctvList = (monitorRes.body?.Detail || []).map(
                        item => ({
                            ...item,
                            IsBroken: item.CameraStatus !== '0',
                            JurisdictionName: `${item.BureauName || ''}-${item.DeptName || ''}`,
                        }),
                    );
                    this.boxList = (chassisRes.body?.Detail || []).map(
                        item => ({
                            ...item,
                            JurisdictionName: `${item.BureauName || ''}-${item.DeptName || ''}`,
                        }),
                    );
                    this.cameraTypeList =
                        this.gisService.cameraTypeList$.getValue();
                    this.cameraTypeList.forEach(item =>
                        this.selectMarkTypes.push(item.value),
                    );
                    this.apiLoaded = mapLoaded;
                }),
                tap(() => this.checkZoom()),
                finalize(() => (this.loading = false)),
            )
            .subscribe();
    }

    /** 地圖點擊處理 */
    mapHandleClick(event: google.maps.MapMouseEvent) {
        console.log(this.gisService.mapEditType)
        if (this.gisService.mapEditType === 'circle') {
            this.addCircleFromClick(event);
        } else if (this.gisService.mapEditType === 'route') {
            this.addWaypointFromClick(event);
        }
    }

    /** 地圖滑鼠移動處理 */
    mapMouseMove(event: google.maps.MapMouseEvent) {
        if (this.gisService.mapEditType === 'circle') {
            this.drawingCircle(event);
        }
    }

    /** 移動至目標視野（涵蓋傳入的所有 boundingbox） */
    setBoundary(boundingboxes: number[][]) {
        if (!this.map || !boundingboxes?.length) return;

        const bounds = new google.maps.LatLngBounds();
        boundingboxes.forEach(box => {
            if (!box || box.length < 4) return;
            // boundingbox 格式：[south, north, west, east]
            bounds.extend(new google.maps.LatLng(box[0], box[2]));
            bounds.extend(new google.maps.LatLng(box[1], box[3]));
        });

        if (!bounds.isEmpty()) this.map.fitBounds(bounds, 40);
    }

    /** 選取 Marker（移動地圖中心） */
    focusMarker(target: { Latitude: number; Longitude: number }) {
        this.center = { lat: target.Latitude, lng: target.Longitude };
        this.zoom = 18;
    }

    /** 地圖點擊新增路徑點 */
    addWaypointFromClick(event: google.maps.MapMouseEvent) {
        const pos = event.latLng?.toJSON();
        if (!pos) return;
        const firstNull = this.routeWaypoints.findIndex(w => w === null);
        if (firstNull < 0) return;
        this.gisService.getAddress(pos.lat, pos.lng).then(address => {
            this.routeWaypoints[firstNull] = pos;
            this.gisService.panelAction$.next({
                type: 'add-waypoint',
                data: { index: firstNull, position: pos, address },
            });
            this.renderRoute();
        });
    }

    /** 計算並渲染路線 */
    renderRoute() {
        const filled = this.routeWaypoints
            .map((w, i) => ({ w, i }))
            .filter(x => x.w !== null);

        if (filled.length < 2) {
            this.directionsResult = null;
            return;
        }

        if (!this.directionsService) {
            this.directionsService = new google.maps.DirectionsService();
        }

        const origin = filled[0].w;
        const destination = filled[filled.length - 1].w;
        const waypoints = filled.slice(1, -1).map(x => ({
            location: x.w as google.maps.LatLngLiteral,
            stopover: true,
        }));

        this.directionsService.route(
            { origin, destination, waypoints, travelMode: google.maps.TravelMode.DRIVING },
            (result, status) => {
                this.directionsResult =
                    status === google.maps.DirectionsStatus.OK ? result : null;
            },
        );
    }

    /** 清除畫面 */
    clearMapDraw() {
        this.circles = [];
        this.routeWaypoints = new Array(8).fill(null);
        this.directionsResult = null;
        this.polygonsList = [];
    }

    sidebarToggle() {
        this.sidebarVisible = !this.sidebarVisible;
        if (this.sidebarVisible) {
            this.mapPanel?.resetToFirstTab();
        } else {
            this.gisService.mapEditType = null;
            this.clearMapDraw();
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                                  資訊窗相關                                  */
    /* -------------------------------------------------------------------------- */
    /** 開啟或關閉 InfoWindow */
    toggleInfoWindow(marker: any, type: 'cctv' | 'chassis') {
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

    /** 更新 InfoWindow 位置 */
    updateDialogPosition(marker: any, event: any) {
        marker.left = event.left;
        marker.top = event.top;
    }

    /** 開啟圖片彈窗 */
    openImgDialog(imgUrl: string) {
        this.imgDialog = { isOpen: true, imgUrl };
    }

    /** InfoWindow 欄位初始設定 */
    initInfoWindow() {
        this.cctvInfoField = [
            { fieldName: '轄區', key: 'JurisdictionName' },
            { fieldName: '攝影機編號', key: 'CamSyncId' },
            { fieldName: '攝影機名稱', key: 'Name' },
            { fieldName: '方向', key: 'Direction' },
            { fieldName: '場勘圖', key: 'Image' },
            { fieldName: '狀態', key: 'CameraStatus' },
        ];
        this.camBoxInfoField = [
            { fieldName: '轄區', key: 'JurisdictionName' },
            { fieldName: '機箱編號', key: 'ChassisId' },
            { fieldName: '機箱名稱', key: 'Name' },
            { fieldName: '場勘圖', key: 'Image' },
            { fieldName: '狀態', key: 'Status' },
            { fieldName: '即時影像', key: 'CamIds' },
        ];
    }

    /* -------------------------------------------------------------------------- */
    /*                                  地圖繪製圓圈範圍                               */
    /* -------------------------------------------------------------------------- */
    drawingCircle(event: google.maps.MapMouseEvent) {
        if (this.isDrawing && event.latLng) {
            const center = new google.maps.LatLng(
                this.tempCircle.center.lat,
                this.tempCircle.center.lng,
            );
            const movingPoint = new google.maps.LatLng(
                event.latLng.lat(),
                event.latLng.lng(),
            );
            const distance =
                google.maps.geometry.spherical.computeDistanceBetween(
                    center,
                    movingPoint,
                );

            //- 超過上限時圓不再變大，並於提示列標示已達上限
            this.radiusCapped = distance > this.gisService.circleMaxRadius;
            this.tempCircle.radius = Math.min(
                distance,
                this.gisService.circleMaxRadius,
            );
        }
    }

    /** 取消繪製中的圓 */
    @HostListener('document:keydown.escape')
    cancelDrawing() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        this.radiusCapped = false;
        this.tempCircle = { center: { lat: 0, lng: 0 }, radius: 0, options: {} };
    }

    /** 拖曳圓圈中心事件 */
    onCenterDragged(event, index: number) {
        const newCenter = event.latLng.toJSON();
        this.circles[index].center = newCenter;
    }

    /** 拖曳結束後反查地址並更新 panel */
    setZoneForm(index: number) {
        const { center, radius } = this.circles[index];
        this.gisService.getAddress(center.lat, center.lng).then((address: string) => {
            if (!this.circles[index]) return;
            this.circles[index].address = address;
            this.gisService.panelAction$.next({
                type: 'update-circle',
                data: { index, center, radius, address },
            });
        });
    }

    /** 於地圖上直接拖曳調整半徑 → 卡控上下限後同步至 panel */
    onCircleRadiusChanged(index: number, circleRef: MapCircle) {
        const circle = this.circles[index];
        const radius = circleRef?.getRadius();
        if (!circle || radius == null) return;

        const newRadius = this.gisService.clampRadius(radius);
        //- 超出範圍時把 Google 的圓拉回上下限（值相同不會觸發 input 更新）
        if (Math.round(radius) !== newRadius) {
            circleRef.circle?.setRadius(newRadius);
        }
        if (newRadius === Math.round(circle.radius)) return;

        circle.radius = newRadius;
        this.gisService.panelAction$.next({
            type: 'update-circle',
            data: {
                index,
                center: circle.center,
                radius: newRadius,
                address: circle.address,
            },
        });
    }

    /** panel 調整半徑 → 同步至地圖 */
    updateCircleRadius(index: number, radius: number) {
        const circle = this.circles[index];
        if (!circle || !radius) return;
        circle.radius = this.gisService.clampRadius(radius);
    }

    /** 強調指定的圓（panel hover 時使用） */
    highlightCircle(index: number | null) {
        this.circles.forEach((circle, i) => {
            if (!circle) return;
            circle.options = this.circleOptions(i === index);
        });
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
            if (!event.latLng) return;

            const firstNullIndex = this.circles.findIndex(item => item === null);
            const nextIndex =
                firstNullIndex >= 0 ? firstNullIndex : this.circles.length;
            if (nextIndex >= this.gisService.circleMaxCount) {
                this.messageService.add({
                    severity: 'warn',
                    summary: `最多只能圈選 ${this.gisService.circleMaxCount} 個範圍`,
                    life: 3000,
                });
                return;
            }

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
        } else {
            const firstNullIndex = this.circles.findIndex(item => item === null);
            const targetIndex =
                firstNullIndex >= 0 ? firstNullIndex : this.circles.length;

            this.isDrawing = false;
            this.radiusCapped = false;
            //- 只點擊未拖曳時，直接採用面板設定的預設半徑
            //- （半徑下限 500 m，門檻放寬避免手抖一下就跳到最小值）
            const radius = this.gisService.clampRadius(
                this.tempCircle.radius < 100
                    ? this.gisService.circleDefaultRadius
                    : this.tempCircle.radius,
            );
            const newCircleData = {
                center: { ...this.tempCircle.center },
                radius,
                index: targetIndex,
            };
            this.addCircle(newCircleData);
            //- 先讓面板出現卡片，地址反查完成後再補上
            this.gisService.panelAction$.next({
                type: 'add-circle',
                data: newCircleData,
            });

            const finalCenter = newCircleData.center;
            this.gisService
                .getAddress(finalCenter.lat, finalCenter.lng)
                .then((address: string) => {
                    if (!this.circles[targetIndex]) return;
                    this.circles[targetIndex].address = address;
                    this.gisService.panelAction$.next({
                        type: 'update-circle',
                        data: {
                            ...newCircleData,
                            radius: this.circles[targetIndex].radius,
                            address,
                        },
                    });
                });
        }
    }

    /** 新增圓圈 */
    addCircle(data: GisCircleType) {
        const { index, center, radius, address } = data;
        this.circles[index] = {
            label: (index + 1).toString(),
            center,
            radius,
            address,
            options: this.circleOptions(false),
        };
    }

    /** 圈選樣式（highlight 為 panel hover 時的強調狀態） */
    private circleOptions(highlight: boolean): google.maps.CircleOptions {
        return {
            fillColor: highlight
                ? 'rgba(255, 0, 0, 0.45)'
                : 'rgba(255, 0, 0, 0.3)',
            strokeColor: '#FF0000',
            strokeWeight: highlight ? 4 : 2,
            clickable: false,
            editable: true,
            draggable: false,
            zIndex: 9999,
        };
    }

    /** 將視野調整至剛建立的圈選範圍 */
    private focusCircle(center: google.maps.LatLngLiteral, radius: number) {
        this.center = center;
        if (!this.map) return;

        const origin = new google.maps.LatLng(center.lat, center.lng);
        const bounds = new google.maps.LatLngBounds();
        [0, 90, 180, 270].forEach(heading => {
            bounds.extend(
                google.maps.geometry.spherical.computeOffset(
                    origin,
                    radius * 1.4,
                    heading,
                ),
            );
        });
        this.map.fitBounds(bounds, 40);
    }

    /** 刪除圓圈 */
    deleteCircle(index: number) {
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
                        if (!onlyMove) {
                            res.geojson.coordinates.forEach(coordinate => {
                                const polygon = coordinate.map(point => ({
                                    lng: point[0],
                                    lat: point[1],
                                }));
                                this.polygonsList.push(polygon);
                            });
                        }
                    });
                    this.setBoundary(
                        resAll
                            .map(res => res?.boundingbox)
                            .filter((box): box is number[] => !!box),
                    );
                }),
                finalize(() => (this.loading = false)),
            )
            .subscribe();
    }

    /* -------------------------------------------------------------------------- */
    /*                                  影像清單                                    */
    /* -------------------------------------------------------------------------- */
    get videoTypes(): VideoDialogMode[] {
        return Object.keys(this.videoDialogTitleMap) as VideoDialogMode[];
    }

    openVideoDialog(mode: VideoDialogMode) {
        if (!this.videoDialog.cameraList[mode]?.length) {
            this.messageService.add({
                severity: 'warn',
                summary: '尚未選擇播放項目',
                detail: '請於地圖攝影機圖示點選右鍵加入播放清單',
                life: 3000,
            });
            return;
        }
        this.videoDialog.mode = mode;
        this.videoDialog.isOpen = true;
    }

    addVideoCamera(mode: VideoDialogMode, marker: CctvMarker) {
        const isExist = this.videoDialog.cameraList[mode].some(
            item => item.CCTVId === marker.CCTVId,
        );
        if (isExist) {
            this.messageService.add({
                severity: 'warn',
                summary: '已存在於播放清單',
                life: 3000,
            });
            return;
        }
        this.videoDialog.cameraList[mode].push(marker);
    }

    deleteCamera(mode: VideoDialogMode, marker: CctvMarker) {
        const index = this.videoDialog.cameraList[mode].findIndex(
            item => item.CCTVId === marker.CCTVId,
        );
        if (index > -1) this.videoDialog.cameraList[mode].splice(index, 1);
    }

    dialogNavigateToRealtime() {
        const cctvIds = this.videoDialog.cameraList.realtime.map(
            item => item.CCTVId,
        );
        if (cctvIds.length) {
            window.open(`/RealtimeVideos?CCTV=${cctvIds.join(',')}`, '_blank');
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                                  右鍵選單                                    */
    /* -------------------------------------------------------------------------- */
    openContextMenu(event: google.maps.MapMouseEvent, markerData: CctvMarker) {
        this.contextMenuItems = [
            {
                label: '加入即時播放清單',
                icon: 'pi pi-plus',
                command: () => this.addVideoCamera('realtime', markerData),
            },
            {
                label: '加入調閱清單',
                icon: 'pi pi-video',
                command: () => this.addVideoCamera('history', markerData),
            },
            {
                label: '加入標註',
                icon: 'pi pi-map-marker',
                command: () =>
                    this.openFavoriteMarkerDialog(
                        markerData.Latitude,
                        markerData.Longitude,
                    ),
            },
            {
                label: '編輯位置',
                icon: 'pi pi-map',
                command: () => this.openCamLocationDialog(markerData),
            },
            { label: '取消', icon: 'pi pi-times' },
        ];
        this.contextMenu.show(event.domEvent as MouseEvent);
    }

    openMapContextMenu(event: google.maps.MapMouseEvent) {
        this.contextMenuItems = [
            {
                label: '加入標註',
                icon: 'pi pi-map-marker',
                command: () =>
                    this.openFavoriteMarkerDialog(
                        event.latLng.lat(),
                        event.latLng.lng(),
                    ),
            },
            { label: '取消', icon: 'pi pi-times' },
        ];
        this.contextMenu.show(event.domEvent as MouseEvent);
    }

    /* -------------------------------------------------------------------------- */
    /*                                  Marker 光暈效果                             */
    /* -------------------------------------------------------------------------- */
    findCams(camIds: string[]) {
        this.removeAllHalos();
        camIds.forEach(camId => {
            const target = this.cctvList.find(item => item.CCTVId === camId);
            if (target && this.selectMarkTypes.includes(target.CCTVType)) {
                this.showHalo({ lat: target.Latitude, lng: target.Longitude });
            }
        });
    }

    findChassis(chassisId: string) {
        this.removeAllHalos();
        const target = this.boxList.find(item => item.ChassisId === chassisId);
        if (target && this.selectMarkTypes.includes(this.caseMarkerType)) {
            this.showHalo({ lat: target.Latitude, lng: target.Longitude });
        }
    }

    showHalo(position: google.maps.LatLngLiteral) {
        const mapInstance = this.map?.googleMap;
        if (!mapInstance) return;
        const halo = this.createFixedSizeHalo(position);
        halo.setMap(mapInstance);
        this.circleOverlays.push(halo);
    }

    createFixedSizeHalo(
        position: google.maps.LatLngLiteral,
    ): google.maps.OverlayView {
        const size = 40;
        return new (class extends google.maps.OverlayView {
            private div!: HTMLDivElement;

            override onAdd() {
                this.div = document.createElement('div');
                Object.assign(this.div.style, {
                    position: 'absolute',
                    width: `${size}px`,
                    height: `${size}px`,
                    borderRadius: '50%',
                    backgroundColor: 'rgba(0, 255, 0, 0.2)',
                    border: '1px solid rgba(0, 255, 0, 0.4)',
                    pointerEvents: 'none',
                });
                this.getPanes()?.overlayMouseTarget.appendChild(this.div);
            }

            override draw() {
                const point = this.getProjection().fromLatLngToDivPixel(
                    new google.maps.LatLng(position.lat, position.lng),
                );
                if (point) {
                    const offset = size / 2;
                    this.div.style.left = `${point.x - offset}px`;
                    this.div.style.top = `${point.y - offset}px`;
                }
            }

            override onRemove() {
                this.div?.remove();
            }
        })();
    }

    removeAllHalos() {
        this.circleOverlays.forEach(circle => circle.setMap(null));
        this.circleOverlays = [];
    }

    /* -------------------------------------------------------------------------- */
    /*                                  個人標註點位                               */
    /* -------------------------------------------------------------------------- */
    openFavoriteMarkerDialog(lat: number, lng: number) {
        this.favoriteMarkerDialog.form.patchValue({
            Name: '',
            Icon: this.favoriteMarkerIcons[0],
            Latitude: lat,
            Longitude: lng,
        });
        this.favoriteMarkerDialog.isOpen = true;
    }

    createFavoriteMarker() {
        const param = this.favoriteMarkerDialog.form.value as PersonalMarker;
        this.favoriteMarkerList = [
            { Id: String(Date.now()), ...param },
            ...this.favoriteMarkerList,
        ];
        this.favoriteMarkerDialog.isOpen = false;
    }

    deleteFavoriteMarker(index: number) {
        this.favoriteMarkerList.splice(index, 1);
        this.favoriteMarkerList = [...this.favoriteMarkerList];
    }

    togglePersonalPanel(event: Event, panel: Popover) {
        if (!this.favoriteMarkerList?.length) {
            this.messageService.add({
                severity: 'warn',
                summary: '尚未新增地圖標註',
                detail: '請於地圖上點擊右鍵加入標註',
                life: 3000,
            });
            panel.hide();
            return;
        }
        panel.toggle(event);
    }

    /* -------------------------------------------------------------------------- */
    /*                                  編輯攝影機位置                               */
    /* -------------------------------------------------------------------------- */
    openCamLocationDialog(marker: CctvMarker) {
        this.camLocationDialog.targetMarker = marker;
        this.camLocationDialog.form.patchValue({
            Direction: Number(marker.Direction),
            Latitude: marker.Latitude,
            Longitude: marker.Longitude,
        });
        this.camLocationDialog.isOpen = true;
    }

    updateCamLocation() {
        const { CCTVId } = this.camLocationDialog.targetMarker;
        const { Direction, Latitude, Longitude } =
            this.camLocationDialog.form.value;

        of(null)
            .pipe(
                tap(() => (this.loading = true)),
                tap(() => {
                    this.gisService
                        .updateMonitorPosition({
                            CCTVId,
                            Direction,
                            Latitude,
                            Longitude,
                        })
                        .subscribe(res => {
                            if (res.code === '000') {
                                const target = this.cctvList.find(
                                    item => item.CCTVId === CCTVId,
                                );
                                if (target) {
                                    target.Direction = String(Direction);
                                    target.Latitude = Latitude;
                                    target.Longitude = Longitude;
                                }
                                this.camLocationDialog.isOpen = false;
                            } else {
                                this.messageService.add({
                                    severity: 'error',
                                    summary: '更新失敗',
                                    detail: res.message,
                                    life: 3000,
                                });
                            }
                            this.loading = false;
                        });
                }),
            )
            .subscribe();
    }

    /* -------------------------------------------------------------------------- */
    /*                                  Map 設定                                   */
    /* -------------------------------------------------------------------------- */
    /** 攝影機類別選單圖示路徑 */
    getSelectorIconUrl(value: string): string {
        const svgValues = new Set(['2']);
        const ext = svgValues.has(value) ? 'svg' : 'png';
        return `assets/img/map/marker/selector/cam_${value}.${ext}`;
    }

    /** 地圖設定 */
    initMapOption() {
        this.mapOptions = {
            disableDefaultUI: true,
            zoomControl: true,
            streetViewControl: true,
            mapTypeControl: true,
            mapTypeControlOptions: {
                position: 20.0,
            },
            clickableIcons: false,
            styles: [
                {
                    featureType: 'poi',
                    elementType: 'all',
                    stylers: [{ visibility: 'off' }],
                },
                {
                    featureType: 'transit',
                    elementType: 'all',
                    stylers: [{ visibility: 'off' }],
                },
            ],
        };
    }
}
