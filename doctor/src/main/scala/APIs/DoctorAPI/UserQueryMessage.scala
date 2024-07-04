package APIs.DoctorAPI

case class UserQueryMessage(userName: String) extends DoctorMessage[Option[String]]