package Impl

import Common.API.{PlanContext, Planner}
import Common.DBAPI.{writeDB, readDBBoolean}
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.DoctorAPI.ChangePasswordMessage
import cats.effect.IO
import io.circe.generic.auto.*

case class ChangePasswordMessagePlanner(userName: String, oldPassword: String, newPassword: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    for {
      // 验证旧密码
      isValidUser <- readDBBoolean(
        s"SELECT EXISTS(SELECT 1 FROM ${schemaName}.user_name WHERE user_name = ? AND password = ?)",
        List(SqlParameter("String", userName), SqlParameter("String", oldPassword))
      )
      result <- if (isValidUser) {
        // 更新密码
        writeDB(
          s"UPDATE ${schemaName}.user_name SET password = ? WHERE user_name = ?",
          List(SqlParameter("String", newPassword), SqlParameter("String", userName))
        ).map(_ => "Password changed successfully")
      } else {
        IO.pure("Invalid old password")
      }
    } yield result
  }