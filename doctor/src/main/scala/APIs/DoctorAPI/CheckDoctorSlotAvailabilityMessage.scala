package APIs.DoctorAPI

case class CheckDoctorSlotAvailabilityMessage(doctorName: String, slotNumber: Int) extends DoctorMessage[Boolean]