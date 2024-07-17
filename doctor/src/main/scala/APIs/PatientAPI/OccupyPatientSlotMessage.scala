package APIs.PatientAPI

case class OccupyPatientSlotMessage(patientName: String, slotNumber: Int, courseName: String) extends PatientMessage[String]