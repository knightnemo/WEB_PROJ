package APIs.LiveStreamAPI

case class GetLiveStreamMessage(name: String) extends LiveStreamMessage[LiveStreamInfo]