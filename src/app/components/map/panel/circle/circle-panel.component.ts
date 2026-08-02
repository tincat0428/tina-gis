import { CommonModule } from '@angular/common';
import {
    Component,
    EventEmitter,
    OnDestroy,
    OnInit,
    Output,
} from '@angular/core';
import {
    AbstractControl,
    FormArray,
    FormBuilder,
    FormGroup,
    FormsModule,
    ReactiveFormsModule,
} from '@angular/forms';
import { from, of, Subject } from 'rxjs';
import {
    catchError,
    debounceTime,
    distinctUntilChanged,
    finalize,
    takeUntil,
    tap,
} from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { SliderModule } from 'primeng/slider';
import { ToastModule } from 'primeng/toast';
import { GisService } from '../../../../services/gis.service';

@Component({
    selector: 'app-circle-panel',
    templateUrl: './circle-panel.component.html',
    styleUrls: ['./circle-panel.component.scss'],
    standalone: true,
    providers: [MessageService],
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        ButtonModule,
        InputNumberModule,
        InputTextModule,
        ProgressSpinnerModule,
        InputGroupModule,
        InputGroupAddonModule,
        SliderModule,
        ToastModule,
    ],
})
export class CirclePanelComponent implements OnInit, OnDestroy {
    @Output() focusMarkerEmitter = new EventEmitter<any>();

    //- 半徑快捷選項（公里）
    readonly radiusPresets = [0.5, 1, 5, 10];

    //- 新增區：地址搜尋
    searchAddress = '';
    addLoading = false;

    //- 查詢結果
    resultList: any[] = [];
    showResult = false;
    searchLoading = false;
    selectedResult: any;

    searchForm: FormGroup;
    private destroy$ = new Subject<void>();

    get incidentLocation(): FormArray {
        return this.searchForm.get('IncidentLocations') as FormArray;
    }

    /** 圈選上限 */
    get maxCount(): number {
        return this.gisService.circleMaxCount;
    }

    /** 半徑可調整範圍（公里，上下限與地圖繪製共用） */
    get minRadiusKm(): number {
        return this.gisService.circleMinRadiusKm;
    }

    get maxRadiusKm(): number {
        return this.gisService.circleMaxRadiusKm;
    }

    /** 下一筆圈選的預設半徑（公里） */
    get nextRadiusKm(): number {
        return this.gisService.toKm(this.gisService.circleDefaultRadius);
    }

    /** 已建立的圈選數量 */
    get filledCount(): number {
        return this.incidentLocation.controls.filter(
            control => control.get('Longitude')?.value != null,
        ).length;
    }

    get isFull(): boolean {
        return this.filledCount >= this.maxCount;
    }

    /** 第一個可用的空位（與地圖端的 index 對應） */
    private get firstEmptyIndex(): number {
        return this.incidentLocation.controls.findIndex(
            control => control.get('Longitude')?.value == null,
        );
    }

    constructor(
        private formBuilder: FormBuilder,
        public gisService: GisService,
        private messageService: MessageService,
    ) {
        this.searchForm = this.formBuilder.group({
            IncidentLocations: this.formBuilder.array([]),
            RequiredCount: [null],
        });
    }

    ngOnInit(): void {
        this.initForm();
        this.gisService.panelAction$
            .pipe(takeUntil(this.destroy$))
            .subscribe(res => {
                if (!res) return;
                if (res.type === 'add-circle') {
                    this.addCircleData(res.data);
                } else if (res.type === 'update-circle') {
                    this.updateCircleData(res.data);
                }
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    /* -------------------------------------------------------------------------- */
    /*                                   新增範圍                                   */
    /* -------------------------------------------------------------------------- */
    /** 變更「下一筆」的預設半徑（輸入為公里） */
    setNextRadius(radiusKm: number) {
        if (!radiusKm) return;
        this.gisService.circleDefaultRadius = this.gisService.clampRadius(
            this.gisService.toMeter(radiusKm),
        );
    }

    /** 快捷鍵顯示文字（未滿 1 公里以公尺表示） */
    presetLabel(radiusKm: number): string {
        return radiusKm < 1 ? `${radiusKm * 1000} m` : `${radiusKm} km`;
    }

    /** 由地址新增圈選範圍 */
    addFromAddress() {
        if (this.addLoading) return;

        const address = this.searchAddress?.trim();
        if (!address) {
            this.toast('請輸入地址');
            return;
        }

        const index = this.firstEmptyIndex;
        if (index < 0) {
            this.toast(`最多只能圈選 ${this.maxCount} 個範圍`);
            return;
        }

        const radius = this.gisService.circleDefaultRadius;
        this.addLoading = true;

        from(this.gisService.getPositionFromAddr(address))
            .pipe(
                tap(res => {
                    this.patchLocation(index, {
                        Radius: radius,
                        Address: address,
                        Longitude: res.lng,
                        Latitude: res.lat,
                    });
                    this.gisService.mapAction$.next({
                        type: 'add-circle',
                        data: { index, center: res, radius, address },
                    });
                    this.searchAddress = '';
                }),
                catchError(err => {
                    this.toast(typeof err === 'string' ? err : '地址查詢失敗');
                    return of(null);
                }),
                finalize(() => (this.addLoading = false)),
                takeUntil(this.destroy$),
            )
            .subscribe();
    }

    /* -------------------------------------------------------------------------- */
    /*                                 已選範圍操作                                  */
    /* -------------------------------------------------------------------------- */
    /** 滑鼠移入卡片時強調對應的圓 */
    highlightCircle(index: number | null) {
        this.gisService.mapAction$.next({
            type: 'highlight-circle',
            data: index,
        });
    }

    /**
     * 半徑的顯示值（公里）
     * FormControl 內存的是公尺，夾在允許範圍內避免 slider 把手跑出軌道
     */
    radiusKm(location: AbstractControl): number {
        const radius = location.get('Radius')?.value;
        return this.gisService.toKm(
            radius == null
                ? this.gisService.circleMinRadius
                : this.gisService.clampRadius(radius),
        );
    }

    /**
     * slider / 數字框調整半徑（輸入為公里，換算成公尺寫回 FormControl）
     * 兩者不能同時綁 formControlName（Angular 以
     * emitModelToViewChange: false 回寫，另一個 CVA 收不到 writeValue），
     * 因此都改為單向綁定後由此統一寫回，另一個欄位與地圖才會一起連動
     */
    setRadius(index: number, radiusKm: number) {
        if (radiusKm == null) return;
        this.incidentLocation
            .at(index)
            .get('Radius')
            .setValue(
                this.gisService.clampRadius(this.gisService.toMeter(radiusKm)),
            );
    }

    /** 移除單筆圈選 */
    removeCircle(index: number) {
        this.clearCircleData(index);
    }

    /** 清空所有圈選 */
    clearAll() {
        this.incidentLocation.controls.forEach((_, i) =>
            this.patchLocation(i, this.emptyLocation()),
        );
        this.gisService.mapAction$.next({ type: 'clear-circles' });
    }

    /* -------------------------------------------------------------------------- */
    /*                                   查詢結果                                   */
    /* -------------------------------------------------------------------------- */
    selectResult(data: any) {
        this.focusMarkerEmitter.emit(data);
        this.selectedResult = data;
    }

    backToSearch() {
        this.showResult = false;
        this.resultList = [];
        this.selectedResult = null;
    }

    toggleHalo(rowData?: any) {
        if (rowData) {
            this.gisService.mapAction$.next({
                type: 'show-halo',
                data: { lat: rowData.Latitude, lng: rowData.Longitude },
            });
        } else {
            this.gisService.mapAction$.next({ type: 'remove-halo' });
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                              地圖 → 面板 資料同步                             */
    /* -------------------------------------------------------------------------- */
    /** 地圖點擊圈選後回填 */
    addCircleData(rowData: any) {
        this.patchLocation(rowData.index, {
            Radius: Math.round(rowData.radius),
            Address: rowData.address,
            Longitude: rowData.center.lng,
            Latitude: rowData.center.lat,
        });
    }

    /** 地圖上拖曳圓心或調整半徑後回填（地址未帶入時保留原值） */
    updateCircleData(rowData: any) {
        const current = this.incidentLocation.at(rowData.index).value;
        this.patchLocation(rowData.index, {
            Radius: Math.round(rowData.radius),
            Address: rowData.address ?? current.Address,
            Longitude: rowData.center.lng,
            Latitude: rowData.center.lat,
        });
    }

    clearCircleData(index: number) {
        this.patchLocation(index, this.emptyLocation());
        this.gisService.mapAction$.next({ type: 'delete-circle', data: index });
    }

    reset() {
        this.searchAddress = '';
        this.incidentLocation.controls.forEach((_, i) =>
            this.patchLocation(i, this.emptyLocation()),
        );
        if (this.showResult) this.backToSearch();
    }

    /* -------------------------------------------------------------------------- */
    /*                                    內部                                     */
    /* -------------------------------------------------------------------------- */
    private initForm() {
        for (let i = 0; i < this.maxCount; i++) {
            const group = this.formBuilder.group({
                Radius: [this.gisService.circleDefaultRadius],
                Address: [null],
                Longitude: [null],
                Latitude: [null],
            });
            this.incidentLocation.push(group);

            //- 面板調整半徑 → 同步至地圖（emitEvent: false 的回填不會觸發）
            group
                .get('Radius')
                .valueChanges.pipe(
                    debounceTime(120),
                    distinctUntilChanged(),
                    takeUntil(this.destroy$),
                )
                .subscribe(radius => this.onRadiusEdited(i, radius));
        }
    }

    private onRadiusEdited(index: number, radius: number) {
        const group = this.incidentLocation.at(index);
        if (!radius || group.get('Longitude')?.value == null) return;

        this.gisService.mapAction$.next({
            type: 'update-circle-radius',
            data: { index, radius },
        });
    }

    /** 一律以 emitEvent: false 回填，避免與地圖之間互相觸發 */
    private patchLocation(index: number, value: Record<string, any>) {
        this.incidentLocation.at(index).patchValue(value, { emitEvent: false });
    }

    private emptyLocation() {
        return {
            Radius: this.gisService.circleDefaultRadius,
            Address: null,
            Longitude: null,
            Latitude: null,
        };
    }

    private toast(summary: string) {
        this.messageService.add({ severity: 'error', summary, life: 3000 });
    }
}
