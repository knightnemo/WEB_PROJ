package APIs.DoctorAPI

case class RegisterMessage(userName: String, password: String, bio: Option[String], gender: Option[String]) extends DoctorMessage[Int]
