package APIs.NotificationAPI

import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto._

case class GetUserNotificationsMessage(username: String) extends NotificationMessage[List[Notification]]

object GetUserNotificationsMessage {
  implicit val encoder: Encoder[GetUserNotificationsMessage] = deriveEncoder[GetUserNotificationsMessage]
  implicit val decoder: Decoder[GetUserNotificationsMessage] = deriveDecoder[GetUserNotificationsMessage]
}