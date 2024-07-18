package APIs.LiveStreamAPI

case class UpdateLiveStreamMessage(
                                    name: String,
                                    classroom: String,
                                    teacher: String,
                                    slot: Int,
                                    capacity: Int,
                                    enrolledCount: Int
                                  ) extends LiveStreamMessage[String]