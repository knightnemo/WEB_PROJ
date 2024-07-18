// GetAllNotificationsMessage.scala
package APIs.NotificationAPI

import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto._

case class GetAllNotificationsMessage() extends NotificationMessage[List[Notification]]

object GetAllNotificationsMessage {
  implicit val encoder: Encoder[GetAllNotificationsMessage] = deriveEncoder[GetAllNotificationsMessage]
  implicit val decoder: Decoder[GetAllNotificationsMessage] = deriveDecoder[GetAllNotificationsMessage]
}