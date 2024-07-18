package APIs.PatientAPI

case class CheckPatientSlotAvailabilityMessage(patientName: String, slotNumber: Int) extends PatientMessage[Boolean]