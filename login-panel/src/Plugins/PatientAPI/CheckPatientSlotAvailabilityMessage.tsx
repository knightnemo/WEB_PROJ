import { PatientMessage } from 'Plugins/PatientAPI/PatientMessage'

export class CheckPatientSlotAvailabilityMessage extends PatientMessage {
    patientName: string;
    slotNumber: number;

    constructor(patientName: string, slotNumber: number) {
        super();
        this.patientName = patientName;
        this.slotNumber = slotNumber;
    }
}