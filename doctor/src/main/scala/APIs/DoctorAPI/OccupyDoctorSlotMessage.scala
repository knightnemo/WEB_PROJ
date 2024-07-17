package APIs.DoctorAPI

case class OccupyDoctorSlotMessage(doctorName: String, slotNumber: Int, courseName: String) extends DoctorMessage[String]