package APIs.NotificationAPI

import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto._

case class DeleteNotificationMessage(id: String) extends NotificationMessage[Boolean]

object DeleteNotificationMessage {
  implicit val encoder: Encoder[DeleteNotificationMessage] = deriveEncoder[DeleteNotificationMessage]
  implicit val decoder: Decoder[DeleteNotificationMessage] = deriveDecoder[DeleteNotificationMessage]
}