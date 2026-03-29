import { CommonModule } from '@angular/common';
import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import {
    FormArray,
    FormBuilder,
    FormGroup,
    ReactiveFormsModule,
} from '@angular/forms';
import { from, of } from 'rxjs';
import { finalize, switchMap, tap } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ToastModule } from 'primeng/toast';
import { GisService } from '../../../../services/gis.service';

@Component({
    selector: 'app-circle-panel',
    templateUrl: './circle-panel.component.html',
    standalone: true,
    providers: [MessageService],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        ButtonModule,
        InputNumberModule,
        InputTextModule,
        ProgressSpinnerModule,
        InputGroupModule,
        InputGroupAddonModule,
        ToastModule,
    ],
})
export class CirclePanelComponent implements OnInit {
    @Output() focusMarkerEmitter = new EventEmitter<any>();

    resultList: any[] = [];
    showResult = false;
    searchLoading = false;
    selectedResult: any;

    hiddenRadiusIdx: number = null;
    incidentLocationCount = 8;
    searchForm: FormGroup;
    private searchingIndexes = new Set<number>();

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
            } else if (res.type === 'update-circle') {
                this.updateCircleData(res.data);
            }
        });
    }

    selectResult(data: any) {
        this.focusMarkerEmitter.emit(data);
        this.selectedResult = data;
    }

    backToSearch() {
        this.showResult = false;
        this.resultList = [];
        this.selectedResult = null;
    }

    reset() {
        this.searchForm.enable();
        this.searchForm.patchValue({
            IncidentLocations: this.incidentLocation.value.map(() => ({
                Radius: 100,
                Address: null,
                Longitude: null,
                Latitude: null,
            })),
        });
        if (this.showResult) this.backToSearch();
    }

    private initForm() {
        const locationsArray = this.searchForm.get('IncidentLocations') as FormArray;
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

    updateCircleData(rowData: any) {
        const targetForm = this.incidentLocation.at(rowData.index);
        targetForm.enable();
        targetForm.patchValue({
            Radius: rowData.radius,
            Address: rowData.address,
            Longitude: rowData.center.lng,
            Latitude: rowData.center.lat,
        });
        targetForm.disable();
    }

    addCircleData(rowData: any) {
        const targetForm = this.incidentLocation.at(rowData.index);
        targetForm.patchValue({
            Radius: rowData.radius,
            Address: rowData.address,
            Longitude: rowData.center.lng,
            Latitude: rowData.center.lat,
        });
        targetForm.disable();
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
        if (this.searchingIndexes.has(index)) return;

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

        this.searchingIndexes.add(index);
        this.clearCircleData(index);

        of(null)
            .pipe(
                switchMap(() => from(this.gisService.getPositionFromAddr(Address))),
                tap(res => {
                    targetForm.patchValue({
                        Longitude: res.lng,
                        Latitude: res.lat,
                        Address,
                    });
                    this.gisService.mapAction$.next({
                        type: 'add-circle',
                        data: { index, center: res, radius: Radius },
                    });
                    targetForm.disable();
                }),
                finalize(() => this.searchingIndexes.delete(index)),
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
