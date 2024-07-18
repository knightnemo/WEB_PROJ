package Global

import Global.GlobalVariables.serviceCode
import cats.effect.IO
import com.comcast.ip4s.Port
import org.http4s.Uri

object ServiceCenter {
  val projectName: String = "APP"

  val dbManagerServiceCode = "A000001"
  val doctorServiceCode = "A000002"
  val patientServiceCode = "A000003"
  val portalServiceCode = "A000004"
  val courseServiceCode = "A000005" // 确保这行存在
  val notificationServiceCode = "A000007"
  val commentServiceCode   = "A000006"
  val liveStreamServiceCode      = "A000009"
  val classroomServiceCode = "A000008"

  val fullNameMap: Map[String, String] = Map(
    dbManagerServiceCode -> "数据库管理（DB_Manager）",
    doctorServiceCode -> "医生（Doctor）",
    patientServiceCode -> "病人（Patient）",
    portalServiceCode -> "门户（Portal）",
    courseServiceCode -> "课程（Course）",
    notificationServiceCode -> "通知（Nitification）",
    commentServiceCode   ->  "评论（Comment）", // 确保这行存在
    liveStreamServiceCode      -> "直播（Live）" ,
    classroomServiceCode -> "教室（classroom）"
  )

  val address: Map[String, String] = Map(
    "DB-Manager" -> "127.0.0.1:10001",
    "Doctor" -> "127.0.0.1:10002",
    "Patient" -> "127.0.0.1:10003",
    "Portal" -> "127.0.0.1:10004",
    "Course" -> "127.0.0.1:10005", // 确保这行存在，并且端口号正确
    "Notification" -> "127.0.0.1:10007",
    "Comment" ->    "127.0.0.1:10006",
    "LiveStream"   ->"127.0.0.1:10009",
    "Classroom" ->      "127.0.0.1:10008"
  )
}
