package APIs.DoctorAPI

case class LoginMessage(userName:String, password:String) extends DoctorMessage[String]
