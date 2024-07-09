// ChangePatientBioMessagePlanner.scala
package Impl

import Common.API.{PlanContext, Planner}
import Common.DBAPI.{writeDB, readDBBoolean}
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.PatientAPI.ChangePatientBioMessage
import cats.effect.IO
import io.circe.generic.auto.*

case class ChangePatientBioMessagePlanner(userName: String, newBio: String, override val planContext: PlanContext) extends Planner[String]:
  private val MaxBioLength = 500 // 设置最大简介长度

  override def plan(using PlanContext): IO[String] = {
    if (newBio.length > MaxBioLength) {
      IO.raiseError(new Exception(s"Bio exceeds maximum length of $MaxBioLength characters"))
    } else {
      for {
        // 验证用户是否存在
        userExists <- readDBBoolean(
          s"SELECT EXISTS(SELECT 1 FROM ${schemaName}.patient WHERE user_name = ?)",
          List(SqlParameter("String", userName))
        )
        result <- if (userExists) {
          // 更新个人简介
          writeDB(
            s"UPDATE ${schemaName}.patient SET bio = ? WHERE user_name = ?",
            List(SqlParameter("String", newBio), SqlParameter("String", userName))
          ).map(_ => s"Bio updated successfully for user: $userName")
        } else {
          IO.pure(s"User not found: $userName")
        }
      } yield result
    }
  }
