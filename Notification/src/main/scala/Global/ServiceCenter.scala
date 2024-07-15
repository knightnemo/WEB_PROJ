package Global

import Global.GlobalVariables.serviceCode
import cats.effect.IO
import com.comcast.ip4s.Port
import org.http4s.Uri

object ServiceCenter {
  val projectName: String = "APP"

  val dbManagerServiceCode = "A000001"
  val doctorServiceCode    = "A000002"
  val patientServiceCode   = "A000003"
  val portalServiceCode    = "A000004"
  val courseServiceCode    = "A000005"  // 新添加的课程服务代码
  val notificationServiceCode = "A000006"

  val fullNameMap: Map[String, String] = Map(
    dbManagerServiceCode ->  "数据库管理（DB_Manager）",
    doctorServiceCode    ->  "医生（Doctor）",
    patientServiceCode   ->  "病人（Patient）",
    portalServiceCode    ->  "门户（Portal）",
    courseServiceCode    ->  "课程（Course）" ,// 新添加的课程服务全名
    notificationServiceCode -> "通知（Notification）"
  )

  val address: Map[String, String] = Map(
    "DB-Manager" ->     "127.0.0.1:10001",
    "Doctor" ->         "127.0.0.1:10002",
    "Patient" ->        "127.0.0.1:10003",
    "Portal" ->         "127.0.0.1:10004",
    "Course" ->         "127.0.0.1:10005",  // 注意：修正了IP地址格式
    "Notification" -> "127.0.0.1:10006"
  )
}