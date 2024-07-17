package APIs.PatientAPI

case class PatientChangePasswordMessage(userName: String, oldPassword: String, newPassword: String) extends PatientMessage[String]

