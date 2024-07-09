package APIs.PatientAPI

case class ChangePatientGenderMessage(userName: String, newGender: String) extends PatientMessage[String]
