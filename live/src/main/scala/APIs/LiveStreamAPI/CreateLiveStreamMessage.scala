package APIs.LiveStreamAPI

case class CreateLiveStreamMessage(
                                    name: String,
                                    classroom: String,
                                    teacher: String,
                                    slot: Int
                                  ) extends LiveStreamMessage[String]