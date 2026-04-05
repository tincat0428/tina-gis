/* 地圖模式 */
export type MapEditType = 'circle' | 'route'

/**
 * 地圖編輯行動
 */
export type MapActionType =
    | 'add-circle'
    | 'update-circle'
    | 'delete-circle'
    | 'add-waypoint'
    | 'update-waypoint'
    | 'delete-waypoint'
    | 'clear-route'
    | 'reorder-waypoints'
    | 'clear'
    | 'show-halo'
    | 'remove-halo'
    | null;

export interface CctvMarker {
    CCTVId: string;
    CCTVType: string;
    Name: string;
    Latitude: number;
    Longitude: number;
    Direction: string;
    IsBroken?: boolean;
    DeptName?: string;
    BureauName?: string;
    Image?: string;
    CameraStatus?: string;
    ChassisId?: string;
    BureauId?: string;
    StationId?: string;
    ViewPointId?: string;
    CamSyncId?: string;
    JurisdictionName?: string;
}

export interface BoxMarker {
    ChassisId: string;
    Name: string;
    Latitude: number;
    Longitude: number;
    Status: string;
    CamIds?: string[];
    DeptName?: string;
    BureauName?: string;
    Image?: string;
    JurisdictionName?: string;
}

export interface PersonalMarker {
    Id?: string;
    Name: string;
    Icon: string;
    Latitude: number;
    Longitude: number;
}

export interface DropDownListModel {
    label: string;
    value: string;
}


export interface GisCircleType {
    index: number;
    center: google.maps.LatLngLiteral;
    radius: number
}