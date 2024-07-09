package APIs.DoctorAPI

case class ChangeGenderMessage(userName: String, newGender: String) extends DoctorMessage[Int]
