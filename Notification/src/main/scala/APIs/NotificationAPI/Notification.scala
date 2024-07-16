// Notification.scala
package APIs.NotificationAPI

import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto._

case class Notification(
                         id: String,
                         title: String,
                         content: String,
                         publisher: String,
                         publishTime: String,
                         recipients: String
                       )

object Notification {
  implicit val encoder: Encoder[Notification] = deriveEncoder[Notification]
  implicit val decoder: Decoder[Notification] = deriveDecoder[Notification]
}