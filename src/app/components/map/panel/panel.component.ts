import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import {
    FormArray,
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
} from '@angular/forms';
import { from, Observable, of } from 'rxjs';
import { finalize, map, switchMap, tap } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { SelectButtonModule } from 'primeng/selectbutton';
import { TabsModule } from 'primeng/tabs';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { GisService } from '../../../services/gis.service';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ToastModule } from 'primeng/toast';

@Component({
    selector: 'app-map-panel',
    templateUrl: './panel.component.html',
    styleUrls: ['./panel.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        ButtonModule,
        InputNumberModule,
        InputTextModule,
        ProgressSpinnerModule,
        SelectModule,
        SelectButtonModule,
        TabsModule,
        InputGroupModule,
        InputGroupAddonModule,
        ToggleSwitchModule,
        ToastModule,
    ],
})
export class MapPanelComponent implements OnInit {
    @Output() cancelEmitter = new EventEmitter<void>();
    @Output() focusMarkerEmitter = new EventEmitter<any>();

    activeIndex = 0;
    resultList: any[] = [];
    showResult = false;
    searchLoading = false;

    stationList: any[] = [];
    villageList: any[] = [];

    matchModeOptions = [
        { label: '聯集', value: 0 },
        { label: '交集', value: 1 },
    ];

    incidentLocationCount = 8;

    searchForm: FormGroup;

    hiddenRadiusIdx: number = null;
    selectedResult: any;

    get incidentLocation(): FormArray {
        return this.searchForm.get('IncidentLocations') as FormArray;
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
        this.gisService.panelAction$.subscribe(res => {
            if (!res) return;
            if (res.type === 'add-circle') {
                this.addCircleData(res.data);
            }
        });
    }

    selectResult(data: any) {
        this.focusMarkerEmitter.emit(data);
        this.selectedResult = data;
    }

    mapEditToggle(checked: boolean) {
        this.gisService.mapEditType = checked ? 'circle' : null;
    }

    backToSearch() {
        this.showResult = false;
        this.resultList = [];
        this.selectedResult = null;
    }

    tabChange() {
        this.clearMap();
        this.stationList = [];
        this.villageList = [];
        this.searchForm.patchValue({
            BureauId: 'all',
            StationId: 'all',
            DistrictId: 'all',
            VillageId: 'all',
            CameraName: '',
            MatchMode: 0,
            IncidentLocations: this.incidentLocation.value.map(() => ({
                Radius: 100,
                Address: null,
            })),
        });
        if (this.showResult) this.backToSearch();
    }

    clearMap() {
        this.gisService.mapEditType = null;
        this.cancelEmitter.emit();
    }

    initForm() {
        const locationsArray = this.searchForm.get(
            'IncidentLocations',
        ) as FormArray;
        for (let i = 0; i < this.incidentLocationCount; i++) {
            locationsArray.push(
                this.formBuilder.group({
                    Radius: [100],
                    Address: [null],
                    Longitude: [null],
                    Latitude: [null],
                }),
            );
        }
    }

    addCircleData(rowData: any) {
        const targetForm = this.incidentLocation.at(rowData.index)
        targetForm.patchValue({
            Radius: rowData.radius,
            Address: rowData.address,
            Longitude: rowData.center.lng,
            Latitude: rowData.center.lat,
        });
        targetForm.disable()
    }

    clearCircleData(index: number) {
        const targetForm = this.incidentLocation.at(index);
        targetForm.enable();
        targetForm.patchValue({
            Radius: 100,
            Address: null,
            Longitude: null,
            Latitude: null,
        });
        this.gisService.mapAction$.next({ type: 'delete-circle', data: index });
    }

    addCircleFromAddr(index: number) {
        const targetForm = this.incidentLocation.controls[index];
        const { Address, Radius } = targetForm.value;

        if (!Address?.length || !Radius) {
            this.messageService.add({
                severity: 'error',
                summary: '請輸入半徑及地址',
                life: 3000,
            });
            return;
        }

        this.clearCircleData(index);

        of(null)
            .pipe(
                switchMap(() =>
                    from(this.gisService.getPositionFromAddr(Address)),
                ),
                tap(res => {
                    targetForm.patchValue({
                        Longitude: res.lng,
                        Latitude: res.lat,
                    });
                    this.gisService.mapAction$.next({
                        type: 'add-circle',
                        data: { index, center: res, radius: Radius },
                    });
                }),
            )
            .subscribe();
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
}
