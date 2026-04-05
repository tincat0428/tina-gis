import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
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
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { ToastModule } from 'primeng/toast';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { GisService } from '../../../../services/gis.service';

@Component({
    selector: 'app-route-panel',
    templateUrl: './route-panel.component.html',
    standalone: true,
    providers: [MessageService],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        ButtonModule,
        InputTextModule,
        InputGroupModule,
        InputGroupAddonModule,
        ToastModule,
        DragDropModule,
    ],
})
export class RoutePanelComponent implements OnInit {
    waypointCount = 8;
    searchForm: FormGroup;
    private searchingIndexes = new Set<number>();

    get waypoints(): FormArray {
        return this.searchForm.get('Waypoints') as FormArray;
    }

    constructor(
        private formBuilder: FormBuilder,
        public gisService: GisService,
        private messageService: MessageService,
    ) {
        this.searchForm = this.formBuilder.group({
            Waypoints: this.formBuilder.array([]),
        });
    }

    ngOnInit(): void {
        this.initForm();
        this.gisService.panelAction$.subscribe(res => {
            if (!res) return;
            if (res.type === 'add-waypoint') {
                this.addWaypointData(res.data);
            } else if (res.type === 'update-waypoint') {
                this.updateWaypointData(res.data);
            }
        });
    }

    getWaypointLabel(index: number): string {
        if (index === 0) return '起點';
        if (index === this.waypointCount - 1) return '終點';
        return `途徑${index}`;
    }

    private initForm() {
        const waypointsArray = this.searchForm.get('Waypoints') as FormArray;
        for (let i = 0; i < this.waypointCount; i++) {
            waypointsArray.push(
                this.formBuilder.group({
                    Address: [null],
                    Longitude: [null],
                    Latitude: [null],
                }),
            );
        }
    }

    addWaypointData(rowData: any) {
        const targetForm = this.waypoints.at(rowData.index);
        targetForm.patchValue({
            Address: rowData.address,
            Longitude: rowData.position.lng,
            Latitude: rowData.position.lat,
        });
        targetForm.disable();
    }

    updateWaypointData(rowData: any) {
        const targetForm = this.waypoints.at(rowData.index);
        targetForm.enable();
        targetForm.patchValue({
            Address: rowData.address,
            Longitude: rowData.position.lng,
            Latitude: rowData.position.lat,
        });
        targetForm.disable();
    }

    clearWaypointData(index: number) {
        const targetForm = this.waypoints.at(index);
        targetForm.enable();
        targetForm.patchValue({ Address: null, Longitude: null, Latitude: null });
        this.gisService.mapAction$.next({ type: 'delete-waypoint', data: index });
    }

    addWaypointFromAddr(index: number) {
        if (this.searchingIndexes.has(index)) return;

        const targetForm = this.waypoints.controls[index];
        const { Address } = targetForm.value;

        if (!Address?.length) {
            this.messageService.add({
                severity: 'error',
                summary: '請輸入地址',
                life: 3000,
            });
            return;
        }

        this.searchingIndexes.add(index);
        this.clearWaypointData(index);

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
                        type: 'add-waypoint',
                        data: { index, position: res },
                    });
                    targetForm.disable();
                }),
                finalize(() => this.searchingIndexes.delete(index)),
            )
            .subscribe();
    }

    drop(event: CdkDragDrop<any[]>) {
        if (event.previousIndex === event.currentIndex) return;
        const fa = this.waypoints;
        const control = fa.at(event.previousIndex);
        fa.removeAt(event.previousIndex);
        fa.insert(event.currentIndex, control);
        this.gisService.mapAction$.next({
            type: 'reorder-waypoints',
            data: fa.controls.map((c, i) => ({
                index: i,
                address: c.get('Address')?.value,
                lng: c.get('Longitude')?.value,
                lat: c.get('Latitude')?.value,
            })),
        });
    }

    reset() {
        this.searchForm.enable();
        this.waypoints.controls.forEach((_, i) => this.clearWaypointData(i));
        this.gisService.mapAction$.next({ type: 'clear-route' });
    }
}
