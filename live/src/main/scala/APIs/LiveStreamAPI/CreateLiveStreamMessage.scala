package APIs.LiveStreamAPI

case class CreateLiveStreamMessage(
                                    name: String,
                                    classroom: String,
                                    teacher: String,
                                    slot: Int,
                                    capacity: Int  // 新增字段
                                  ) extends LiveStreamMessage[String]