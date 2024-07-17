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
  val courseServiceCode    = "A000005"
  val commentServiceCode   = "A000006"  // 新添加的评论服务代码

  val fullNameMap: Map[String, String] = Map(
    dbManagerServiceCode ->  "数据库管理（DB_Manager）",
    doctorServiceCode    ->  "医生（Doctor）",
    patientServiceCode   ->  "病人（Patient）",
    portalServiceCode    ->  "门户（Portal）",
    courseServiceCode    ->  "课程（Course）",
    commentServiceCode   ->  "评论（Comment）"  // 新添加的评论服务全名
  )

  val address: Map[String, String] = Map(
    "DB-Manager" ->     "127.0.0.1:10001",
    "Doctor" ->         "127.0.0.1:10002",
    "Patient" ->        "127.0.0.1:10003",
    "Portal" ->         "127.0.0.1:10004",
    "Course" ->         "127.0.0.1:10005",
    "Comment" ->        "127.0.0.1:10006"  // 新添加的评论服务地址
  )
}