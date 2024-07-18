package APIs.LiveStreamAPI

case class CheckLiveStreamAvailabilityMessage(name: String, slotNumber: Int) extends LiveStreamMessage[Boolean]