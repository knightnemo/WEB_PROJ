import { PatientMessage } from 'Plugins/PatientAPI/PatientMessage'

export class OccupyPatientSlotMessage extends PatientMessage {
    patientName: string;
    slotNumber: number;
    courseName: string;

    constructor(patientName: string, slotNumber: number, courseName: string) {
        super();
        this.patientName = patientName;
        this.slotNumber = slotNumber;
        this.courseName = courseName;
    }
}