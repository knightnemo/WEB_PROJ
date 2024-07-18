package APIs.DoctorAPI

case class ChangePasswordMessage(userName: String, oldPassword: String, newPassword: String) extends DoctorMessage[String]
