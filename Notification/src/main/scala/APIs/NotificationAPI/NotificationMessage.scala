// NotificationMessage.scala
package APIs.NotificationAPI

import Common.API.API
import Global.ServiceCenter.notificationServiceCode
import io.circe.Decoder

abstract class NotificationMessage[ReturnType: Decoder] extends API[ReturnType](notificationServiceCode)