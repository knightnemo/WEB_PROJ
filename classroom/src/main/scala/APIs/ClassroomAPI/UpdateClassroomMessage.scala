package APIs.ClassroomAPI

case class UpdateClassroomMessage(
                                   id: String,
                                   name: String,
                                   capacity: Int,
                                   slot1: String,
                                   slot2: String,
                                   slot3: String,
                                   slot4: String,
                                   slot5: String,
                                   slot6: String,
                                   slot7: String,
                                   slot8: String
                                 ) extends ClassroomMessage[String]