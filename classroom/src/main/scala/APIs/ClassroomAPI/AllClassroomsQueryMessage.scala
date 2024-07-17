// AllClassroomsQueryMessage.scala
package APIs.ClassroomAPI

import Common.API.API
import Global.ServiceCenter.classroomServiceCode
import io.circe.Decoder

case class AllClassroomsQueryMessage() extends ClassroomMessage[List[Classroom]]

object AllClassroomsQueryMessage {
  implicit val decoder: Decoder[AllClassroomsQueryMessage] = Decoder.const(AllClassroomsQueryMessage())
}