package APIs.LiveStreamAPI

case class UpdateLiveStreamCapacityMessage(liveStreamId: String) extends LiveStreamMessage[String]