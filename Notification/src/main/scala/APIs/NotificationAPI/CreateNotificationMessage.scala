package APIs.NotificationAPI

import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto._

case class CreateNotificationMessage(title: String, content: String, recipients: List[String]) extends NotificationMessage[Notification]

object CreateNotificationMessage {
  implicit val encoder: Encoder[CreateNotificationMessage] = deriveEncoder[CreateNotificationMessage]
  implicit val decoder: Decoder[CreateNotificationMessage] = deriveDecoder[CreateNotificationMessage]
}